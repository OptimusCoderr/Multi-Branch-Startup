import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { incrementBranchStock, incrementWarehouseStock, recordStockMovement, createProductBatch } from "@/server/services/inventory-service";
import { BatchRequiredError } from "@/server/services/transfer-service";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  | "purchaseOrder"
  | "purchaseOrderLineItem"
  | "supplier"
  | "product"
  | "branch"
  | "warehouse"
  | "company"
  | "branchStock"
  | "warehouseStock"
  | "stockMovement"
  | "productBatch"
  | "notification"
  | "membership"
>;

export class PurchaseOrderNotFoundError extends Error {
  constructor() {
    super("Purchase order not found.");
    this.name = "PurchaseOrderNotFoundError";
  }
}

export class PurchaseOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseOrderStateError";
  }
}

async function getPurchaseOrderOrThrow(tx: ScopedTx, poId: string) {
  const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lineItems: true } });
  if (!po) throw new PurchaseOrderNotFoundError();
  return po;
}

type PODestination = { destinationBranchId: string; destinationWarehouseId?: never } | { destinationWarehouseId: string; destinationBranchId?: never };

export async function createPurchaseOrder(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: {
    supplierId: string;
    expectedDate?: Date;
    notes?: string;
    lineItems: { productId: string; quantityOrdered: number; unitCost: number }[];
  } & PODestination,
) {
  if (input.lineItems.length === 0) {
    throw new PurchaseOrderStateError("A purchase order needs at least one line item.");
  }

  // Every FK must be verified to belong to this tenant before it's ever
  // written onto the PurchaseOrder row — same defensive check
  // requestTransfer() does for the exact same reason (getScopedPrisma only
  // forces the row's own companyId, it never validates that FKs the caller
  // supplied actually point into this company).
  const [supplier, destinationBranch, destinationWarehouse, products] = await Promise.all([
    tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, isActive: true } }),
    input.destinationBranchId ? tx.branch.findUnique({ where: { id: input.destinationBranchId }, select: { id: true } }) : null,
    input.destinationWarehouseId ? tx.warehouse.findUnique({ where: { id: input.destinationWarehouseId }, select: { id: true } }) : null,
    tx.product.findMany({ where: { id: { in: input.lineItems.map((li) => li.productId) } }, select: { id: true } }),
  ]);
  if (!supplier) throw new PurchaseOrderStateError("Selected supplier not found.");
  if (!supplier.isActive) throw new PurchaseOrderStateError("This supplier is archived and cannot receive new orders.");
  if (input.destinationBranchId && !destinationBranch) throw new PurchaseOrderStateError("Destination branch not found.");
  if (input.destinationWarehouseId && !destinationWarehouse) throw new PurchaseOrderStateError("Destination warehouse not found.");
  const foundProductIds = new Set(products.map((p) => p.id));
  for (const li of input.lineItems) {
    if (!foundProductIds.has(li.productId)) throw new PurchaseOrderStateError("One of the selected products was not found.");
    if (li.quantityOrdered <= 0) throw new PurchaseOrderStateError("Ordered quantity must be greater than zero.");
  }

  // Atomically allocate the next sequential PO number for this company —
  // same collision-safety pattern as Sale.saleNumber (sale-service.ts).
  const company = await tx.company.update({
    where: { id: companyId },
    data: { poCounter: { increment: 1 } },
  });
  const poNumber = `PO-${String(company.poCounter).padStart(6, "0")}`;

  return tx.purchaseOrder.create({
    data: {
      companyId,
      poNumber,
      supplierId: input.supplierId,
      destinationBranchId: input.destinationBranchId ?? null,
      destinationWarehouseId: input.destinationWarehouseId ?? null,
      expectedDate: input.expectedDate ?? null,
      notes: input.notes ?? null,
      createdByMembershipId: membershipId,
      status: "DRAFT",
      lineItems: {
        create: input.lineItems.map((li) => ({
          productId: li.productId,
          quantityOrdered: li.quantityOrdered,
          unitCost: li.unitCost,
        })),
      },
    },
    include: { lineItems: true },
  });
}

export async function markPurchaseOrderOrdered(tx: ScopedTx, membershipId: string, poId: string) {
  const po = await getPurchaseOrderOrThrow(tx, poId);
  if (po.status !== "DRAFT") {
    throw new PurchaseOrderStateError("Only draft purchase orders can be marked as ordered.");
  }
  if (po.lineItems.length === 0) {
    throw new PurchaseOrderStateError("A purchase order needs at least one line item before it can be ordered.");
  }

  return tx.purchaseOrder.update({
    where: { id: poId },
    data: { status: "ORDERED", orderedByMembershipId: membershipId, orderedAt: new Date() },
  });
}

/** Allowed only before anything has actually been delivered against this PO. */
export async function cancelPurchaseOrder(tx: ScopedTx, membershipId: string, poId: string) {
  const po = await getPurchaseOrderOrThrow(tx, poId);
  if (po.status !== "DRAFT" && po.status !== "ORDERED") {
    throw new PurchaseOrderStateError("Only draft or ordered purchase orders can be cancelled.");
  }
  if (po.lineItems.some((li) => li.quantityReceived > 0)) {
    throw new PurchaseOrderStateError("This purchase order already has received stock and cannot be cancelled.");
  }

  return tx.purchaseOrder.update({
    where: { id: poId },
    data: { status: "CANCELLED", cancelledByMembershipId: membershipId, cancelledAt: new Date() },
  });
}

/**
 * One line item per call — mirrors receiveTransfer()'s one-transfer-per-
 * call shape. Rejects (rather than caps) a quantity that would push the
 * line's cumulative received above what was ordered, so an over-delivery
 * has to be a deliberate, separate correction rather than silently eaten.
 * After the update, recomputes the parent PO's status from all of its line
 * items: fully received across the board -> RECEIVED, any partial ->
 * PARTIALLY_RECEIVED.
 */
export async function receivePurchaseOrderLineItem(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  lineItemId: string,
  quantityReceived: number,
  batch?: { batchNumber: string; expiryDate: Date; manufactureDate?: Date },
) {
  // PurchaseOrderLineItem has no companyId column of its own (same as
  // SaleLineItem), so getScopedPrisma can't auto-scope this lookup or its
  // nested `include` — the tenant check below is load-bearing, not
  // defense-in-depth, to prevent a crafted lineItemId from another
  // company's PO from ever reaching the stock-mutating calls further down.
  const lineItem = await tx.purchaseOrderLineItem.findUnique({
    where: { id: lineItemId },
    include: { purchaseOrder: true },
  });
  if (!lineItem || lineItem.purchaseOrder.companyId !== companyId) throw new PurchaseOrderNotFoundError();

  const po = lineItem.purchaseOrder;
  if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") {
    throw new PurchaseOrderStateError("This purchase order is not ready to be received against.");
  }
  if (quantityReceived <= 0) {
    throw new PurchaseOrderStateError("Received quantity must be greater than zero.");
  }
  const remaining = lineItem.quantityOrdered - lineItem.quantityReceived;
  if (quantityReceived > remaining) {
    throw new PurchaseOrderStateError(`Cannot receive more than the ${remaining} unit(s) still outstanding on this line item.`);
  }

  const product = await tx.product.findUnique({ where: { id: lineItem.productId }, select: { tracksBatches: true } });
  if (product?.tracksBatches && !batch) {
    throw new BatchRequiredError();
  }

  if (po.destinationBranchId) {
    await incrementBranchStock(tx, lineItem.productId, po.destinationBranchId, quantityReceived);
    await recordStockMovement(tx, {
      companyId,
      productId: lineItem.productId,
      locationType: "BRANCH",
      branchId: po.destinationBranchId,
      quantityDelta: quantityReceived,
      reason: "PURCHASE_RECEIPT",
      referenceType: "PurchaseOrder",
      referenceId: po.id,
      performedByMembershipId: membershipId,
    });
  } else {
    await incrementWarehouseStock(tx, lineItem.productId, po.destinationWarehouseId!, quantityReceived);
    await recordStockMovement(tx, {
      companyId,
      productId: lineItem.productId,
      locationType: "WAREHOUSE",
      warehouseId: po.destinationWarehouseId!,
      quantityDelta: quantityReceived,
      reason: "PURCHASE_RECEIPT",
      referenceType: "PurchaseOrder",
      referenceId: po.id,
      performedByMembershipId: membershipId,
    });
  }

  if (batch) {
    await createProductBatch(tx, companyId, membershipId, {
      productId: lineItem.productId,
      ...(po.destinationBranchId ? { branchId: po.destinationBranchId } : { warehouseId: po.destinationWarehouseId! }),
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      manufactureDate: batch.manufactureDate,
      quantity: quantityReceived,
    });
  }

  const updatedLineItem = await tx.purchaseOrderLineItem.update({
    where: { id: lineItemId },
    data: { quantityReceived: { increment: quantityReceived } },
  });

  const allLineItems = await tx.purchaseOrderLineItem.findMany({ where: { purchaseOrderId: po.id } });
  const allReceived = allLineItems.every((li) => li.quantityReceived >= li.quantityOrdered);
  const anyReceived = allLineItems.some((li) => li.quantityReceived > 0);

  const updatedPo = await tx.purchaseOrder.update({
    where: { id: po.id },
    data: { status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status },
  });

  return { lineItem: updatedLineItem, purchaseOrder: updatedPo };
}
