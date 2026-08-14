import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  "warehouse" | "branch" | "product" | "warehouseStock" | "branchStock"
>;

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
