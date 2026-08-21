import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import {
  decrementWarehouseStock,
  decrementBranchStock,
  incrementBranchStock,
  recordStockMovement,
  createProductBatch,
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

  if (transfer.sourceWarehouseId) {
    await decrementWarehouseStock(tx, transfer.productId, transfer.sourceWarehouseId, transfer.quantity);
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
    await decrementBranchStock(tx, transfer.productId, transfer.sourceBranchId!, transfer.quantity);
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
    data: { status: "IN_TRANSIT", dispatchedByMembershipId: membershipId, dispatchedAt: new Date() },
  });
}

/**
 * Receiving is allowed from APPROVED (dispatch was skipped — a same-
 * building move) or IN_TRANSIT (dispatch already happened). When dispatch
 * was skipped, this does the source decrement AND the destination
 * increment atomically, since there was no separate dispatch step to have
 * done the decrement. A receivedQuantity that differs from the requested
 * quantity is recorded as-is (never silently corrected) and flagged for
 * the caller to audit-log as a discrepancy.
 */
export async function receiveTransfer(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  transferId: string,
  receivedQuantity: number,
  notes?: string,
) {
  const transfer = await getTransferOrThrow(tx, transferId);
  if (transfer.status !== "APPROVED" && transfer.status !== "IN_TRANSIT") {
    throw new TransferStateError("This transfer is not ready to be received.");
  }

  if (transfer.status === "APPROVED") {
    if (!transfer.sourceWarehouseId && !transfer.sourceBranchId) {
      throw new TransferStateError("This transfer has no source location to receive from.");
    }
    if (transfer.sourceWarehouseId) {
      await decrementWarehouseStock(tx, transfer.productId, transfer.sourceWarehouseId, transfer.quantity);
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
      await decrementBranchStock(tx, transfer.productId, transfer.sourceBranchId!, transfer.quantity);
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

  await incrementBranchStock(tx, transfer.productId, transfer.destinationBranchId, receivedQuantity);
  await recordStockMovement(tx, {
    companyId,
    productId: transfer.productId,
    locationType: "BRANCH",
    branchId: transfer.destinationBranchId,
    quantityDelta: receivedQuantity,
    reason: "TRANSFER_IN",
    referenceType: "StockTransfer",
    referenceId: transfer.id,
    stockTransferId: transfer.id,
    performedByMembershipId: membershipId,
  });

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
 * A supplier delivering straight to a branch, bypassing a warehouse
 * entirely. Still modeled as a StockTransfer row (not a separate entity)
 * so every "how did stock get here" query has one place to look, but it's
 * a single-step create-and-receive action — there's no internal
 * counterparty to request from or approve against.
 */
export class BatchRequiredError extends Error {
  constructor() {
    super("This product tracks batches — batch number and expiry date are required.");
    this.name = "BatchRequiredError";
  }
}

export async function receiveExternalStock(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: {
    productId: string;
    quantity: number;
    destinationBranchId: string;
    externalSourceName: string;
    notes?: string;
    batch?: { batchNumber: string; expiryDate: Date; manufactureDate?: Date };
  },
) {
  const product = await tx.product.findUnique({ where: { id: input.productId }, select: { tracksBatches: true } });
  if (product?.tracksBatches && !input.batch) {
    throw new BatchRequiredError();
  }

  const transfer = await tx.stockTransfer.create({
    data: {
      companyId,
      productId: input.productId,
      quantity: input.quantity,
      sourceType: "EXTERNAL",
      externalSourceName: input.externalSourceName,
      destinationBranchId: input.destinationBranchId,
      status: "RECEIVED",
      requestedByMembershipId: membershipId,
      receivedByMembershipId: membershipId,
      receivedAt: new Date(),
      receivedQuantity: input.quantity,
      notes: input.notes ?? null,
    },
  });

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

  if (input.batch) {
    await createProductBatch(tx, companyId, membershipId, {
      productId: input.productId,
      branchId: input.destinationBranchId,
      batchNumber: input.batch.batchNumber,
      expiryDate: input.batch.expiryDate,
      manufactureDate: input.batch.manufactureDate,
      quantity: input.quantity,
    });
  }

  return transfer;
}
