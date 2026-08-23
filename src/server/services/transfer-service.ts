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
import { createWaybillForTransfer } from "@/server/services/waybill-service";

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
  | "notification"
  | "membership"
  | "waybill"
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

export async function requestTransfer(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: { productId: string; quantity: number; destinationBranchId: string; notes?: string },
) {
  // Every FK below must be verified to belong to this tenant BEFORE it's
  // ever written onto the StockTransfer row — getScopedPrisma only forces
  // the row's own companyId, it never validates that FKs the caller
  // supplied actually point into the same company. Skipping this let a
  // crafted request (bypassing the UI's own tenant-scoped dropdowns, e.g.
  // a raw POST) persist another company's real product/branch id on a
  // transfer this company owns — later rendered by-name on the transfers
  // list/detail pages via `include`, which (unlike a top-level query)
  // isn't re-scoped by the tenant-isolation extension.
  const [product, destinationBranch] = await Promise.all([
    tx.product.findUnique({ where: { id: input.productId }, select: { id: true } }),
    tx.branch.findUnique({ where: { id: input.destinationBranchId }, select: { id: true } }),
  ]);
  if (!product) throw new TransferStateError("Selected product not found.");
  if (!destinationBranch) throw new TransferStateError("Destination branch not found.");

  // No source is picked here — a reviewer chooses warehouse, another
  // branch, or an external supplier at approval time (see resolveTransfer
  // below). sourceType stays null until then.
  return tx.stockTransfer.create({
    data: {
      companyId,
      productId: input.productId,
      quantity: input.quantity,
      destinationBranchId: input.destinationBranchId,
      status: "REQUESTED",
      requestedByMembershipId: membershipId,
      notes: input.notes ?? null,
    },
  });
}

type TransferResolution =
  | { sourceType: "WAREHOUSE"; sourceWarehouseId: string }
  | { sourceType: "BRANCH"; sourceBranchId: string }
  | {
      sourceType: "EXTERNAL";
      externalSourceName: string;
      batch?: { batchNumber: string; expiryDate: Date; manufactureDate?: Date };
    };

/**
 * Requester and approver must be different people by default — this is
 * the accountability guarantee that a transfer was actually checked by a
 * second person, not just self-certified by whoever asked for the stock.
 *
 * The reviewer picks the source here (the requester never did — see
 * requestTransfer). A WAREHOUSE or BRANCH source still needs a physical
 * dispatch/receive to move the stock, same as before. An EXTERNAL source
 * has no internal counterparty to dispatch from, so approving it credits
 * the destination branch immediately, the same as the direct
 * receiveExternalStock path — the transfer goes straight to RECEIVED.
 */
export async function approveTransfer(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  transferId: string,
  resolution: TransferResolution,
) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "REQUESTED") {
    throw new TransferStateError("Only requested transfers can be approved.");
  }
  if (transfer.requestedByMembershipId === membershipId) {
    throw new TransferStateError("You cannot approve a transfer you requested yourself.");
  }
  if (!transfer.destinationBranchId) {
    throw new TransferStateError("This transfer has no destination branch.");
  }
  const destinationBranchId = transfer.destinationBranchId;

  if (resolution.sourceType === "BRANCH" && resolution.sourceBranchId === destinationBranchId) {
    throw new TransferStateError("A branch cannot supply stock to itself.");
  }

  // Same cross-tenant FK guard as requestTransfer — the reviewer's picks
  // come from a tenant-scoped dropdown, but a crafted request could still
  // try to smuggle another company's id through.
  if (resolution.sourceType === "WAREHOUSE") {
    const sourceWarehouse = await tx.warehouse.findUnique({ where: { id: resolution.sourceWarehouseId }, select: { id: true } });
    if (!sourceWarehouse) throw new TransferStateError("Source warehouse not found.");
  } else if (resolution.sourceType === "BRANCH") {
    const sourceBranch = await tx.branch.findUnique({ where: { id: resolution.sourceBranchId }, select: { id: true } });
    if (!sourceBranch) throw new TransferStateError("Source branch not found.");
  }

  if (resolution.sourceType === "EXTERNAL") {
    const product = await tx.product.findUnique({ where: { id: transfer.productId }, select: { tracksBatches: true } });
    if (product?.tracksBatches && !resolution.batch) {
      throw new BatchRequiredError();
    }

    const updated = await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        sourceType: "EXTERNAL",
        externalSourceName: resolution.externalSourceName,
        status: "RECEIVED",
        approvedByMembershipId: membershipId,
        approvedAt: new Date(),
        receivedByMembershipId: membershipId,
        receivedAt: new Date(),
        receivedQuantity: transfer.quantity,
      },
    });

    await incrementBranchStock(tx, transfer.productId, destinationBranchId, transfer.quantity);
    await recordStockMovement(tx, {
      companyId,
      productId: transfer.productId,
      locationType: "BRANCH",
      branchId: destinationBranchId,
      quantityDelta: transfer.quantity,
      reason: "EXTERNAL_RECEIPT",
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      stockTransferId: transfer.id,
      performedByMembershipId: membershipId,
    });

    if (resolution.batch) {
      await createProductBatch(tx, companyId, membershipId, {
        productId: transfer.productId,
        branchId: destinationBranchId,
        batchNumber: resolution.batch.batchNumber,
        expiryDate: resolution.batch.expiryDate,
        manufactureDate: resolution.batch.manufactureDate,
        quantity: transfer.quantity,
      });
    }

    return updated;
  }

  return tx.stockTransfer.update({
    where: { id: transferId },
    data: {
      sourceType: resolution.sourceType,
      sourceWarehouseId: resolution.sourceType === "WAREHOUSE" ? resolution.sourceWarehouseId : null,
      sourceBranchId: resolution.sourceType === "BRANCH" ? resolution.sourceBranchId : null,
      status: "APPROVED",
      approvedByMembershipId: membershipId,
      approvedAt: new Date(),
    },
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
 * confirmed received. A warehouse-sourced dispatch also seals a Waybill
 * at this exact moment (see waybill-service.ts) — a branch-sourced one
 * doesn't, since waybills are the opt-in-by-source-being-a-warehouse
 * stricter receiving mode.
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
    dispatchedBatches = await decrementWarehouseStock(tx, companyId, transfer.productId, transfer.sourceWarehouseId, transfer.quantity);
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
    await createWaybillForTransfer(tx, companyId, transfer.id);
  } else {
    // Captured here (not re-derived at receipt) because FEFO order can
    // shift between dispatch and receipt — a later delivery or another
    // sale could add/consume batches at this branch in the meantime.
    dispatchedBatches = await decrementBranchStock(tx, companyId, transfer.productId, transfer.sourceBranchId!, transfer.quantity);
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

  // A warehouse-sourced transfer's waybill match/mismatch is checked and
  // recorded by the action layer BEFORE this ever gets called — see
  // guardWaybillReceive() in waybill-service.ts and its caller in
  // transfers.ts's receiveTransfer action. It has to be a separate,
  // already-committed transaction: a mismatch needs to permanently record
  // the attempt (and possibly LOCK) even though the receive itself must
  // NOT proceed, and a single Prisma transaction can't partially commit —
  // recording the attempt inside this transaction would roll back the
  // instant this function threw to block the receive.
  return landReceipt(tx, companyId, membershipId, transfer, receivedQuantity, notes, manualBatch);
}

/**
 * The actual stock-landing logic, shared by receiveTransfer() above (once
 * the action layer's waybill guard — if any — has already passed) and
 * resolveLockedWaybill()'s "accept the last count" path below.
 */
async function landReceipt(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  transfer: Awaited<ReturnType<typeof getTransferOrThrow>>,
  receivedQuantity: number,
  notes?: string,
  manualBatch?: { batchNumber: string; expiryDate: Date; manufactureDate?: Date },
) {
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
      batchesToLand = await decrementWarehouseStock(tx, companyId, transfer.productId, transfer.sourceWarehouseId, transfer.quantity);
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
      batchesToLand = await decrementBranchStock(tx, companyId, transfer.productId, transfer.sourceBranchId!, transfer.quantity);
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
    where: { id: transfer.id },
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
    tx.product.findUnique({ where: { id: input.productId }, select: { tracksBatches: true } }),
    input.destinationBranchId ? tx.branch.findUnique({ where: { id: input.destinationBranchId }, select: { id: true } }) : null,
    input.destinationWarehouseId ? tx.warehouse.findUnique({ where: { id: input.destinationWarehouseId }, select: { id: true } }) : null,
  ]);
  if (!product) throw new TransferStateError("Selected product not found.");
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

export class WaybillResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WaybillResolutionError";
  }
}

/**
 * The only way past a LOCKED waybill — an Owner/Admin either accepts the
 * receiver's last declared count (landing it exactly like a normal
 * receive would have, had it matched) or rejects the transfer outright,
 * which reverses the dispatch: the stock that left the warehouse at
 * dispatch time is given back, and the transfer becomes CANCELLED. Either
 * way the waybill is marked resolved so it drops off the "needs review"
 * list.
 */
export async function resolveLockedWaybill(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  waybillId: string,
  resolution: "ACCEPT_LAST_COUNT" | "REJECT_AND_REVERSE",
) {
  const waybill = await tx.waybill.findUnique({ where: { id: waybillId } });
  if (!waybill) throw new WaybillResolutionError("Waybill not found.");
  if (waybill.status !== "LOCKED" || waybill.resolvedAt) {
    throw new WaybillResolutionError("This waybill isn't awaiting resolution.");
  }
  const transfer = await getTransferOrThrow(tx, waybill.stockTransferId);

  if (resolution === "ACCEPT_LAST_COUNT") {
    if (waybill.lastDeclaredQuantity === null) {
      throw new WaybillResolutionError("No declared count to accept.");
    }
    const result = await landReceipt(
      tx,
      companyId,
      membershipId,
      transfer,
      waybill.lastDeclaredQuantity,
      "Resolved from a locked waybill: accepted the last declared count.",
    );
    await tx.waybill.update({
      where: { id: waybillId },
      data: { status: "MATCHED", resolvedByMembershipId: membershipId, resolvedAt: new Date() },
    });
    return result;
  }

  // REJECT_AND_REVERSE — a LOCKED waybill only ever exists on a
  // warehouse-sourced, already-dispatched transfer (see
  // createWaybillForTransfer), so sourceWarehouseId is always set here.
  await incrementWarehouseStock(tx, transfer.productId, transfer.sourceWarehouseId!, transfer.quantity);
  await recordStockMovement(tx, {
    companyId,
    productId: transfer.productId,
    locationType: "WAREHOUSE",
    warehouseId: transfer.sourceWarehouseId!,
    quantityDelta: transfer.quantity,
    reason: "TRANSFER_REVERSED",
    referenceType: "StockTransfer",
    referenceId: transfer.id,
    stockTransferId: transfer.id,
    performedByMembershipId: membershipId,
  });
  const updated = await tx.stockTransfer.update({
    where: { id: transfer.id },
    data: { status: "CANCELLED", cancelledByMembershipId: membershipId, cancelledAt: new Date() },
  });
  await tx.waybill.update({
    where: { id: waybillId },
    data: { resolvedByMembershipId: membershipId, resolvedAt: new Date() },
  });
  return { transfer: updated, hasDiscrepancy: false };
}
