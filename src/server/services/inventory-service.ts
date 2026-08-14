import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  "warehouse" | "branch" | "product" | "warehouseStock" | "branchStock" | "stockMovement"
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

/**
 * Decrements warehouse stock atomically: the WHERE clause (quantity >=
 * requested amount) and the decrement happen in a single Postgres UPDATE
 * statement, so two concurrent transfers/sales racing for the last units
 * can't both succeed and drive the quantity negative — one of them will
 * match zero rows and this throws instead.
 */
export async function decrementWarehouseStock(
  tx: ScopedTx,
  productId: string,
  warehouseId: string,
  quantity: number,
) {
  const result = await tx.warehouseStock.updateMany({
    where: { productId, warehouseId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) throw new InsufficientStockError();
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

/** See decrementWarehouseStock — same atomic guard, applied to branch stock. */
export async function decrementBranchStock(tx: ScopedTx, productId: string, branchId: string, quantity: number) {
  const result = await tx.branchStock.updateMany({
    where: { productId, branchId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) throw new InsufficientStockError();
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
  reason: "TRANSFER_IN" | "TRANSFER_OUT" | "EXTERNAL_RECEIPT" | "SALE" | "SALE_VOID_RESTOCK" | "ADJUSTMENT" | "INITIAL_STOCK";
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
