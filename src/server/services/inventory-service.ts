import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { createNotifications, getOwnerAndAdminMembershipIds } from "@/server/services/notification-service";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  | "warehouse"
  | "branch"
  | "product"
  | "warehouseStock"
  | "branchStock"
  | "stockMovement"
  | "productBatch"
  | "notification"
  | "membership"
>;

export class InsufficientStockError extends Error {
  constructor(message = "Not enough stock available at the source location.") {
    super(message);
    this.name = "InsufficientStockError";
  }
}

/**
 * Every active location gets a zeroed stock row for a brand-new product, and
 * every active product gets a zeroed stock row for a brand-new location —
 * so "how much of X do we have at Y" never has to special-case a missing
 * row. Called inside the same transaction as the Product/Warehouse/Branch
 * creation.
 */
export async function provisionStockForNewProduct(tx: ScopedTx, companyId: string, productId: string) {
  const [warehouses, branches] = await Promise.all([
    tx.warehouse.findMany({ where: { isActive: true }, select: { id: true } }),
    tx.branch.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);

  if (warehouses.length > 0) {
    await tx.warehouseStock.createMany({
      data: warehouses.map((w) => ({ companyId, productId, warehouseId: w.id })),
      skipDuplicates: true,
    });
  }
  if (branches.length > 0) {
    await tx.branchStock.createMany({
      data: branches.map((b) => ({ companyId, productId, branchId: b.id })),
      skipDuplicates: true,
    });
  }
}

export async function provisionStockForNewWarehouse(tx: ScopedTx, companyId: string, warehouseId: string) {
  const products = await tx.product.findMany({ where: { isActive: true }, select: { id: true } });
  if (products.length > 0) {
    await tx.warehouseStock.createMany({
      data: products.map((p) => ({ companyId, productId: p.id, warehouseId })),
      skipDuplicates: true,
    });
  }
}

export async function provisionStockForNewBranch(tx: ScopedTx, companyId: string, branchId: string) {
  const products = await tx.product.findMany({ where: { isActive: true }, select: { id: true } });
  if (products.length > 0) {
    await tx.branchStock.createMany({
      data: products.map((p) => ({ companyId, productId: p.id, branchId })),
      skipDuplicates: true,
    });
  }
}

export type ConsumedBatch = { batchId: string; batchNumber: string; expiryDate: Date; quantity: number };

export type LowStockProduct = { productId: string; name: string; sku: string; totalStock: number; reorderPoint: number };

/**
 * Total stock for one product across every warehouse and branch, against
 * its configured reorder point — the single-product version of
 * getLowStockProducts() below, used to check whether a decrement just
 * pushed this specific product at-or-below its threshold. Returns null
 * when the product has no reorderPoint configured (no alert wanted) or
 * isn't currently at-or-below it.
 */
async function checkLowStock(tx: ScopedTx, productId: string): Promise<LowStockProduct | null> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      reorderPoint: true,
      warehouseStocks: { select: { quantity: true } },
      branchStocks: { select: { quantity: true } },
    },
  });
  if (!product || product.reorderPoint === null) return null;

  const totalStock =
    product.warehouseStocks.reduce((sum, w) => sum + w.quantity, 0) + product.branchStocks.reduce((sum, b) => sum + b.quantity, 0);
  if (totalStock > product.reorderPoint) return null;

  return { productId: product.id, name: product.name, sku: product.sku, totalStock, reorderPoint: product.reorderPoint };
}

/**
 * Notifies Owner + Admin the moment a decrement pushes a product
 * at-or-below its reorder point — but only on the crossing itself
 * (preTotal was still above it), not on every subsequent sale while a
 * product stays low, so this doesn't spam one notification per sale.
 * quantityJustRemoved is what the caller just decremented, used to
 * reconstruct the pre-decrement total without a second read.
 */
async function notifyIfLowStockCrossing(tx: ScopedTx, companyId: string, productId: string, quantityJustRemoved: number) {
  const low = await checkLowStock(tx, productId);
  if (!low) return;

  const preTotal = low.totalStock + quantityJustRemoved;
  if (preTotal <= low.reorderPoint) return; // was already low before this decrement — already notified

  const recipientIds = await getOwnerAndAdminMembershipIds(tx);
  if (recipientIds.length === 0) return;

  await createNotifications(tx, companyId, recipientIds, {
    type: "LOW_STOCK",
    title: `${low.name} is running low`,
    body: `${low.name} (${low.sku}) is down to ${low.totalStock} unit(s) across all locations — at or below its reorder point of ${low.reorderPoint}.`,
    entityType: "Product",
    entityId: low.productId,
  });
}

/**
 * Decrements warehouse stock atomically: the WHERE clause (quantity >=
 * requested amount) and the decrement happen in a single Postgres UPDATE
 * statement, so two concurrent transfers/sales racing for the last units
 * can't both succeed and drive the quantity negative — one of them will
 * match zero rows and this throws instead.
 *
 * Also FEFO-consumes batches at this warehouse for a batch-tracked
 * product, identically to decrementBranchStock below (see its docstring
 * for the full reasoning — best-effort, never a second source of truth to
 * block on). Returns exactly which batch(es) were consumed so a caller
 * dispatching a warehouse-sourced transfer can carry that identity
 * forward to the receiving branch, the same way a branch-sourced
 * transfer already does.
 */
export async function decrementWarehouseStock(
  tx: ScopedTx,
  companyId: string,
  productId: string,
  warehouseId: string,
  quantity: number,
): Promise<ConsumedBatch[]> {
  const result = await tx.warehouseStock.updateMany({
    where: { productId, warehouseId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) throw new InsufficientStockError();
  await notifyIfLowStockCrossing(tx, companyId, productId, quantity);

  const product = await tx.product.findUnique({ where: { id: productId }, select: { tracksBatches: true } });
  if (!product?.tracksBatches) return [];

  let remainingToConsume = quantity;
  const consumed: ConsumedBatch[] = [];
  const batches = await tx.productBatch.findMany({
    where: { productId, warehouseId, quantityRemaining: { gt: 0 } },
    orderBy: { expiryDate: "asc" },
  });

  for (const batch of batches) {
    if (remainingToConsume <= 0) break;
    const consumeFromThisBatch = Math.min(batch.quantityRemaining, remainingToConsume);

    const updated = await tx.productBatch.updateMany({
      where: { id: batch.id, quantityRemaining: { gte: consumeFromThisBatch } },
      data: { quantityRemaining: { decrement: consumeFromThisBatch } },
    });
    if (updated.count > 0) {
      remainingToConsume -= consumeFromThisBatch;
      consumed.push({ batchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, quantity: consumeFromThisBatch });
    }
  }
  return consumed;
}

export async function incrementWarehouseStock(
  tx: ScopedTx,
  productId: string,
  warehouseId: string,
  quantity: number,
) {
  await tx.warehouseStock.updateMany({
    where: { productId, warehouseId },
    data: { quantity: { increment: quantity } },
  });
}

/**
 * See decrementWarehouseStock — same atomic guard, applied to branch
 * stock. Additionally, for a batch-tracked product (Product.tracksBatches),
 * consumes the soonest-expiring batches first (FEFO) at this branch —
 * every stock decrement funnels through here (sales, dispatch-side of a
 * branch-to-branch transfer), so this is the one place batch consumption
 * can happen transparently without every caller needing to know batches
 * exist. Best-effort: if batches at this branch sum to less than
 * `quantity` (e.g. stock was adjusted by hand without a matching batch
 * correction), consumes what batches there are and stops — the aggregate
 * BranchStock decrement above is what actually gates whether the sale
 * was allowed at all; batch remaining-quantity is a derived tracking
 * signal, not a second source of truth to block on.
 *
 * Returns exactly which batch(es) were consumed (and how much of each) —
 * callers that need to reverse this later (voidSale) or recreate the same
 * batch identity elsewhere (a branch-sourced transfer's receiving end)
 * persist this rather than re-deriving it, since FEFO order can shift
 * between when stock leaves and when a caller might want to undo it.
 */
export async function decrementBranchStock(
  tx: ScopedTx,
  companyId: string,
  productId: string,
  branchId: string,
  quantity: number,
): Promise<ConsumedBatch[]> {
  const result = await tx.branchStock.updateMany({
    where: { productId, branchId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) throw new InsufficientStockError();
  await notifyIfLowStockCrossing(tx, companyId, productId, quantity);

  const product = await tx.product.findUnique({ where: { id: productId }, select: { tracksBatches: true } });
  if (!product?.tracksBatches) return [];

  let remainingToConsume = quantity;
  const consumed: ConsumedBatch[] = [];
  const batches = await tx.productBatch.findMany({
    where: { productId, branchId, quantityRemaining: { gt: 0 } },
    orderBy: { expiryDate: "asc" },
  });

  for (const batch of batches) {
    if (remainingToConsume <= 0) break;
    const consumeFromThisBatch = Math.min(batch.quantityRemaining, remainingToConsume);

    const updated = await tx.productBatch.updateMany({
      where: { id: batch.id, quantityRemaining: { gte: consumeFromThisBatch } },
      data: { quantityRemaining: { decrement: consumeFromThisBatch } },
    });
    if (updated.count > 0) {
      remainingToConsume -= consumeFromThisBatch;
      consumed.push({ batchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, quantity: consumeFromThisBatch });
    }
  }
  return consumed;
}

type BatchLocation = { branchId: string; warehouseId?: never } | { warehouseId: string; branchId?: never };

/**
 * Records a batch-tracked product entering a branch OR a warehouse —
 * external delivery (transfer-service.ts's receiveExternalStock), or a
 * batch-tracked transfer landing at its destination (receiveTransfer).
 * quantityRemaining starts equal to quantityReceived;
 * decrementBranchStock()/decrementWarehouseStock() consumes it down FEFO
 * as the product sells, moves on, or leaves again.
 *
 * A second delivery under an already-used (companyId, productId,
 * branchId/warehouseId, batchNumber) — a realistic multi-shipment restock
 * of the same lot — increments the existing row instead of colliding with
 * its unique constraint; a bare `create` here would otherwise throw and
 * roll back an entire otherwise-valid delivery.
 */
export async function createProductBatch(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: { productId: string; batchNumber: string; expiryDate: Date; manufactureDate?: Date; quantity: number } & BatchLocation,
) {
  const locationWhere = input.branchId ? { branchId: input.branchId } : { warehouseId: input.warehouseId };

  const existing = await tx.productBatch.findFirst({
    where: { productId: input.productId, ...locationWhere, batchNumber: input.batchNumber },
    select: { id: true },
  });

  if (existing) {
    await tx.productBatch.update({
      where: { id: existing.id },
      data: {
        quantityReceived: { increment: input.quantity },
        quantityRemaining: { increment: input.quantity },
        expiryDate: input.expiryDate,
        manufactureDate: input.manufactureDate ?? undefined,
      },
    });
    return;
  }

  await tx.productBatch.create({
    data: {
      companyId,
      productId: input.productId,
      branchId: input.branchId ?? null,
      warehouseId: input.warehouseId ?? null,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      manufactureDate: input.manufactureDate ?? null,
      quantityReceived: input.quantity,
      quantityRemaining: input.quantity,
      receivedByMembershipId: membershipId,
    },
  });
}

export async function incrementBranchStock(tx: ScopedTx, productId: string, branchId: string, quantity: number) {
  await tx.branchStock.updateMany({
    where: { productId, branchId },
    data: { quantity: { increment: quantity } },
  });
}

type RecordStockMovementInput = {
  companyId: string;
  productId: string;
  quantityDelta: number;
  reason:
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "EXTERNAL_RECEIPT"
    | "SALE"
    | "SALE_VOID_RESTOCK"
    | "ADJUSTMENT"
    | "INITIAL_STOCK"
    | "PURCHASE_RECEIPT"
    | "TRANSFER_REVERSED";
  referenceType: string;
  referenceId: string;
  performedByMembershipId: string;
  stockTransferId?: string;
} & ({ locationType: "WAREHOUSE"; warehouseId: string } | { locationType: "BRANCH"; branchId: string });

/** Appends one row to the immutable stock ledger. Never updated or deleted. */
export async function recordStockMovement(tx: ScopedTx, input: RecordStockMovementInput) {
  await tx.stockMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      locationType: input.locationType,
      warehouseId: input.locationType === "WAREHOUSE" ? input.warehouseId : null,
      branchId: input.locationType === "BRANCH" ? input.branchId : null,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      stockTransferId: input.stockTransferId ?? null,
      performedByMembershipId: input.performedByMembershipId,
    },
  });
}

/**
 * Products at or below their configured reorder point, summed across
 * every warehouse and branch — a company-wide total, not per-location,
 * so an owner reasons about one number per product rather than a
 * location matrix. Products with no reorderPoint set are never included
 * (null means "no alert configured," not "alert at zero").
 */
export async function getLowStockProducts(tx: ScopedTx): Promise<LowStockProduct[]> {
  const products = await tx.product.findMany({
    where: { isActive: true, reorderPoint: { not: null } },
    select: {
      id: true,
      name: true,
      sku: true,
      reorderPoint: true,
      warehouseStocks: { select: { quantity: true } },
      branchStocks: { select: { quantity: true } },
    },
  });

  return products
    .map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      totalStock: p.warehouseStocks.reduce((sum, w) => sum + w.quantity, 0) + p.branchStocks.reduce((sum, b) => sum + b.quantity, 0),
      reorderPoint: p.reorderPoint!,
    }))
    .filter((p) => p.totalStock <= p.reorderPoint)
    .sort((a, b) => a.totalStock - b.totalStock);
}

export type ExpiringBatch = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  locationName: string;
  locationType: "BRANCH" | "WAREHOUSE";
  batchNumber: string;
  expiryDate: Date;
  quantityRemaining: number;
  isExpired: boolean;
};

/** Batches with stock still remaining, expiring within `withinDays` (default 14) — including already-expired ones, sorted soonest first. Covers both branch and warehouse locations, since a perishable can sit at either before it sells. */
export async function getExpiringBatches(tx: ScopedTx, withinDays = 14): Promise<ExpiringBatch[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const now = new Date();

  const batches = await tx.productBatch.findMany({
    where: { quantityRemaining: { gt: 0 }, expiryDate: { lte: cutoff } },
    orderBy: { expiryDate: "asc" },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      branch: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    productId: b.product.id,
    productName: b.product.name,
    productSku: b.product.sku,
    locationName: b.branch?.name ?? b.warehouse!.name,
    locationType: b.branch ? "BRANCH" : "WAREHOUSE",
    batchNumber: b.batchNumber,
    expiryDate: b.expiryDate,
    quantityRemaining: b.quantityRemaining,
    isExpired: b.expiryDate < now,
  }));
}
