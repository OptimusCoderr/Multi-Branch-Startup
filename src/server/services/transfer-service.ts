import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import type { Prisma } from "@prisma/client";
import {
  decrementWarehouseStock,
  decrementBranchStock,
  incrementWarehouseStock,
  incrementBranchStock,
  recordStockMovement,
  createProductBatch,
  type ConsumedBatch,
} from "@/server/services/inventory-service";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  | "stockTransfer"
  | "warehouseStock"
  | "branchStock"
  | "stockMovement"
  | "product"
  | "warehouse"
  | "branch"
  | "productBatch"
>;

export class TransferNotFoundError extends Error {
  constructor() {
    super("Stock transfer not found.");
    this.name = "TransferNotFoundError";
  }
}

export class TransferStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferStateError";
  }
}

async function getTransferOrThrow(tx: ScopedTx, transferId: string) {
  const transfer = await tx.stockTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) throw new TransferNotFoundError();
  return transfer;
}

type TransferSource = { sourceWarehouseId: string; sourceBranchId?: never } | { sourceBranchId: string; sourceWarehouseId?: never };

export async function requestTransfer(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: { productId: string; quantity: number; destinationBranchId: string; notes?: string } & TransferSource,
) {
  if (input.sourceBranchId && input.sourceBranchId === input.destinationBranchId) {
    throw new TransferStateError("A branch cannot transfer stock to itself.");
  }

  // Every FK below must be verified to belong to this tenant BEFORE it's
  // ever written onto the StockTransfer row — getScopedPrisma only forces
  // the row's own companyId, it never validates that FKs the caller
  // supplied actually point into the same company. Skipping this let a
  // crafted request (bypassing the UI's own tenant-scoped dropdowns, e.g.
  // a raw POST) persist another company's real product/branch/warehouse
  // id on a transfer this company owns — later rendered by-name on the
  // transfers list/detail pages via `include`, which (unlike a top-level
  // query) isn't re-scoped by the tenant-isolation extension.
  const [product, destinationBranch, sourceWarehouse, sourceBranch] = await Promise.all([
    // SERVICE products carry no stock to transfer — treated the same as a
    // nonexistent product below.
    tx.product.findUnique({ where: { id: input.productId }, select: { id: true, productType: true } }),
    tx.branch.findUnique({ where: { id: input.destinationBranchId }, select: { id: true } }),
    input.sourceWarehouseId ? tx.warehouse.findUnique({ where: { id: input.sourceWarehouseId }, select: { id: true } }) : null,
    input.sourceBranchId ? tx.branch.findUnique({ where: { id: input.sourceBranchId }, select: { id: true } }) : null,
  ]);
  if (!product || product.productType === "SERVICE") throw new TransferStateError("Selected product not found.");
  if (!destinationBranch) throw new TransferStateError("Destination branch not found.");
  if (input.sourceWarehouseId && !sourceWarehouse) throw new TransferStateError("Source warehouse not found.");
  if (input.sourceBranchId && !sourceBranch) throw new TransferStateError("Source branch not found.");

  return tx.stockTransfer.create({
    data: {
      companyId,
      productId: input.productId,
      quantity: input.quantity,
      sourceType: input.sourceWarehouseId ? "WAREHOUSE" : "BRANCH",
      sourceWarehouseId: input.sourceWarehouseId ?? null,
      sourceBranchId: input.sourceBranchId ?? null,
      destinationBranchId: input.destinationBranchId,
      status: "REQUESTED",
      requestedByMembershipId: membershipId,
      notes: input.notes ?? null,
    },
  });
}

/**
 * Requester and approver must be different people by default — this is
 * the accountability guarantee that a transfer was actually checked by a
 * second person, not just self-certified by whoever asked for the stock.
 */
export async function approveTransfer(tx: ScopedTx, membershipId: string, transferId: string) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "REQUESTED") {
    throw new TransferStateError("Only requested transfers can be approved.");
  }
  if (transfer.requestedByMembershipId === membershipId) {
    throw new TransferStateError("You cannot approve a transfer you requested yourself.");
  }

  return tx.stockTransfer.update({
    where: { id: transferId },
    data: { status: "APPROVED", approvedByMembershipId: membershipId, approvedAt: new Date() },
  });
}

export async function rejectTransfer(tx: ScopedTx, membershipId: string, transferId: string, reason: string) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "REQUESTED") {
    throw new TransferStateError("Only requested transfers can be rejected.");
  }

  return tx.stockTransfer.update({
    where: { id: transferId },
    data: { status: "REJECTED", rejectedByMembershipId: membershipId, rejectedAt: new Date(), rejectionReason: reason },
  });
}

/** Cancellation is only allowed before stock has physically left the warehouse. */
export async function cancelTransfer(tx: ScopedTx, membershipId: string, transferId: string) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "REQUESTED" && transfer.status !== "APPROVED") {
    throw new TransferStateError("Only requested or approved transfers can be cancelled.");
  }

  return tx.stockTransfer.update({
    where: { id: transferId },
    data: { status: "CANCELLED", cancelledByMembershipId: membershipId, cancelledAt: new Date() },
  });
}

/**
 * Dispatch decrements the source (warehouse OR branch — see
 * requestTransfer) immediately — stock leaves custody the moment it's on
 * its way, mirroring physical reality, rather than waiting until it's
 * confirmed received.
 */
export async function dispatchTransfer(tx: ScopedTx, companyId: string, membershipId: string, transferId: string) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "APPROVED") {
    throw new TransferStateError("Only approved transfers can be dispatched.");
  }
  if (!transfer.sourceWarehouseId && !transfer.sourceBranchId) {
    throw new TransferStateError("This transfer has no source location to dispatch from.");
  }

  let dispatchedBatches: ConsumedBatch[] = [];

  if (transfer.sourceWarehouseId) {
    // Captured here (not re-derived at receipt) for the same reason as the
    // branch case below — FEFO order can shift between dispatch and
    // receipt.
    dispatchedBatches = await decrementWarehouseStock(tx, transfer.productId, transfer.sourceWarehouseId, transfer.quantity);
    await recordStockMovement(tx, {
      companyId,
      productId: transfer.productId,
      locationType: "WAREHOUSE",
      warehouseId: transfer.sourceWarehouseId,
      quantityDelta: -transfer.quantity,
      reason: "TRANSFER_OUT",
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      stockTransferId: transfer.id,
      performedByMembershipId: membershipId,
    });
  } else {
    // Captured here (not re-derived at receipt) because FEFO order can
    // shift between dispatch and receipt — a later delivery or another
    // sale could add/consume batches at this branch in the meantime.
    dispatchedBatches = await decrementBranchStock(tx, transfer.productId, transfer.sourceBranchId!, transfer.quantity);
    await recordStockMovement(tx, {
      companyId,
      productId: transfer.productId,
      locationType: "BRANCH",
      branchId: transfer.sourceBranchId!,
      quantityDelta: -transfer.quantity,
      reason: "TRANSFER_OUT",
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      stockTransferId: transfer.id,
      performedByMembershipId: membershipId,
    });
  }

  return tx.stockTransfer.update({
    where: { id: transferId },
    data: {
      status: "IN_TRANSIT",
      dispatchedByMembershipId: membershipId,
      dispatchedAt: new Date(),
      dispatchedBatches: dispatchedBatches.length > 0 ? (dispatchedBatches as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}

/** Walks `batches` in order, taking up to `quantity` total — for capping a dispatched-batch snapshot down to what was actually received when there's a discrepancy. */
function capBatchesToQuantity(batches: ConsumedBatch[], quantity: number): ConsumedBatch[] {
  let remaining = quantity;
  const capped: ConsumedBatch[] = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    capped.push({ ...b, quantity: take });
    remaining -= take;
  }
  return capped;
}

/**
 * Receiving is allowed from APPROVED (dispatch was skipped — a same-
 * building move) or IN_TRANSIT (dispatch already happened). When dispatch
 * was skipped, this does the source decrement AND the destination
 * increment atomically, since there was no separate dispatch step to have
 * done the decrement. A receivedQuantity that differs from the requested
 * quantity is recorded as-is (never silently corrected) and flagged for
 * the caller to audit-log as a discrepancy.
 *
 * For a batch-tracked product, the destination gets the *same* batch
 * identity (batch number + expiry) the source's stock actually came from
 * — captured at dispatch (or just now, if dispatch was skipped) — so
 * expiry tracking survives the move instead of silently disappearing.
 * This works the same whether the source was a branch or a warehouse
 * (both track batches). The receiver only needs to supply one manually
 * when the source location genuinely had no matching batch rows to
 * consume from (e.g. batch tracking was turned on for the product after
 * stock already existed there) — same requirement an external delivery
 * already has.
 */
export async function receiveTransfer(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  transferId: string,
  receivedQuantity: number,
  notes?: string,
  manualBatch?: { batchNumber: string; expiryDate: Date; manufactureDate?: Date },
) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "APPROVED" && transfer.status !== "IN_TRANSIT") {
    throw new TransferStateError("This transfer is not ready to be received.");
  }
  // The internal request/approve/dispatch/receive flow this function
  // handles always targets a branch — only an EXTERNAL delivery
  // (receiveExternalStock, a separate single-step function) can target a
  // warehouse instead. Asserted here once so every use below can stay a
  // plain string.
  if (!transfer.destinationBranchId) {
    throw new TransferStateError("This transfer has no destination branch.");
  }
  const destinationBranchId = transfer.destinationBranchId;

  // JSON round-tripping serializes Date -> ISO string, so a snapshot read
  // back from a prior dispatch needs its expiryDate re-parsed — unlike a
  // snapshot captured moments ago in the APPROVED (skip-dispatch) branch
  // below, which is still a real ConsumedBatch[] with genuine Date objects.
  const storedBatches = transfer.dispatchedBatches as unknown as
    | { batchId: string; batchNumber: string; expiryDate: string; quantity: number }[]
    | null;
  let batchesToLand: ConsumedBatch[] = (storedBatches ?? []).map((b) => ({ ...b, expiryDate: new Date(b.expiryDate) }));

  if (transfer.status === "APPROVED") {
    if (!transfer.sourceWarehouseId && !transfer.sourceBranchId) {
      throw new TransferStateError("This transfer has no source location to receive from.");
    }
    if (transfer.sourceWarehouseId) {
      batchesToLand = await decrementWarehouseStock(tx, transfer.productId, transfer.sourceWarehouseId, transfer.quantity);
      await recordStockMovement(tx, {
        companyId,
        productId: transfer.productId,
        locationType: "WAREHOUSE",
        warehouseId: transfer.sourceWarehouseId,
        quantityDelta: -transfer.quantity,
        reason: "TRANSFER_OUT",
        referenceType: "StockTransfer",
        referenceId: transfer.id,
        stockTransferId: transfer.id,
        performedByMembershipId: membershipId,
      });
    } else {
      batchesToLand = await decrementBranchStock(tx, transfer.productId, transfer.sourceBranchId!, transfer.quantity);
      await recordStockMovement(tx, {
        companyId,
        productId: transfer.productId,
        locationType: "BRANCH",
        branchId: transfer.sourceBranchId!,
        quantityDelta: -transfer.quantity,
        reason: "TRANSFER_OUT",
        referenceType: "StockTransfer",
        referenceId: transfer.id,
        stockTransferId: transfer.id,
        performedByMembershipId: membershipId,
      });
    }
  }

  const product = await tx.product.findUnique({ where: { id: transfer.productId }, select: { tracksBatches: true } });
  if (product?.tracksBatches && batchesToLand.length === 0 && !manualBatch) {
    throw new BatchRequiredError();
  }

  await incrementBranchStock(tx, transfer.productId, destinationBranchId, receivedQuantity);
  await recordStockMovement(tx, {
    companyId,
    productId: transfer.productId,
    locationType: "BRANCH",
    branchId: destinationBranchId,
    quantityDelta: receivedQuantity,
    reason: "TRANSFER_IN",
    referenceType: "StockTransfer",
    referenceId: transfer.id,
    stockTransferId: transfer.id,
    performedByMembershipId: membershipId,
  });

  if (manualBatch) {
    await createProductBatch(tx, companyId, membershipId, {
      productId: transfer.productId,
      branchId: destinationBranchId,
      batchNumber: manualBatch.batchNumber,
      expiryDate: manualBatch.expiryDate,
      manufactureDate: manualBatch.manufactureDate,
      quantity: receivedQuantity,
    });
  } else if (batchesToLand.length > 0) {
    for (const b of capBatchesToQuantity(batchesToLand, receivedQuantity)) {
      await createProductBatch(tx, companyId, membershipId, {
        productId: transfer.productId,
        branchId: destinationBranchId,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
      });
    }
  }

  const updated = await tx.stockTransfer.update({
    where: { id: transferId },
    data: {
      status: "RECEIVED",
      receivedByMembershipId: membershipId,
      receivedAt: new Date(),
      receivedQuantity,
      notes: notes ?? transfer.notes,
    },
  });

  return { transfer: updated, hasDiscrepancy: receivedQuantity !== transfer.quantity };
}

/**
 * A supplier delivering straight to a branch OR a warehouse, bypassing the
 * usual request/approve/dispatch/receive chain entirely. Still modeled as
 * a StockTransfer row (not a separate entity) so every "how did stock get
 * here" query has one place to look, but it's a single-step
 * create-and-receive action — there's no internal counterparty to
 * request from or approve against. A warehouse destination exists so a
 * perishable delivery that's going to sit in a warehouse before reaching
 * a branch still gets proper expiry tracking from the moment it arrives,
 * rather than only once it's transferred out to a branch.
 */
export class BatchRequiredError extends Error {
  constructor() {
    super("This product tracks batches — batch number and expiry date are required.");
    this.name = "BatchRequiredError";
  }
}

type ExternalDestination = { destinationBranchId: string; destinationWarehouseId?: never } | { destinationWarehouseId: string; destinationBranchId?: never };

export async function receiveExternalStock(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: {
    productId: string;
    quantity: number;
    externalSourceName: string;
    notes?: string;
    batch?: { batchNumber: string; expiryDate: Date; manufactureDate?: Date };
  } & ExternalDestination,
) {
  const [product, destinationBranch, destinationWarehouse] = await Promise.all([
    // SERVICE products carry no stock — a delivery of one is nonsensical.
    tx.product.findUnique({ where: { id: input.productId }, select: { tracksBatches: true, productType: true } }),
    input.destinationBranchId ? tx.branch.findUnique({ where: { id: input.destinationBranchId }, select: { id: true } }) : null,
    input.destinationWarehouseId ? tx.warehouse.findUnique({ where: { id: input.destinationWarehouseId }, select: { id: true } }) : null,
  ]);
  if (!product || product.productType === "SERVICE") throw new TransferStateError("Selected product not found.");
  if (input.destinationBranchId && !destinationBranch) throw new TransferStateError("Destination branch not found.");
  if (input.destinationWarehouseId && !destinationWarehouse) throw new TransferStateError("Destination warehouse not found.");
  if (product.tracksBatches && !input.batch) {
    throw new BatchRequiredError();
  }

  const transfer = await tx.stockTransfer.create({
    data: {
      companyId,
      productId: input.productId,
      quantity: input.quantity,
      sourceType: "EXTERNAL",
      externalSourceName: input.externalSourceName,
      destinationBranchId: input.destinationBranchId ?? null,
      destinationWarehouseId: input.destinationWarehouseId ?? null,
      status: "RECEIVED",
      requestedByMembershipId: membershipId,
      receivedByMembershipId: membershipId,
      receivedAt: new Date(),
      receivedQuantity: input.quantity,
      notes: input.notes ?? null,
    },
  });

  if (input.destinationBranchId) {
    await incrementBranchStock(tx, input.productId, input.destinationBranchId, input.quantity);
    await recordStockMovement(tx, {
      companyId,
      productId: input.productId,
      locationType: "BRANCH",
      branchId: input.destinationBranchId,
      quantityDelta: input.quantity,
      reason: "EXTERNAL_RECEIPT",
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      stockTransferId: transfer.id,
      performedByMembershipId: membershipId,
    });
  } else {
    await incrementWarehouseStock(tx, input.productId, input.destinationWarehouseId!, input.quantity);
    await recordStockMovement(tx, {
      companyId,
      productId: input.productId,
      locationType: "WAREHOUSE",
      warehouseId: input.destinationWarehouseId!,
      quantityDelta: input.quantity,
      reason: "EXTERNAL_RECEIPT",
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      stockTransferId: transfer.id,
      performedByMembershipId: membershipId,
    });
  }

  if (input.batch) {
    await createProductBatch(tx, companyId, membershipId, {
      productId: input.productId,
      ...(input.destinationBranchId ? { branchId: input.destinationBranchId } : { warehouseId: input.destinationWarehouseId! }),
      batchNumber: input.batch.batchNumber,
      expiryDate: input.batch.expiryDate,
      manufactureDate: input.batch.manufactureDate,
      quantity: input.quantity,
    });
  }

  return transfer;
}
