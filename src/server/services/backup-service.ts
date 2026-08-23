import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = ReturnType<typeof getScopedPrisma>;

/**
 * A company-scoped data export — NOT a raw database dump. A literal
 * `pg_dump`-style backup would leak every other tenant's rows in this
 * multi-tenant schema, so this instead assembles just the calling
 * company's own core business records (the same data the "Never lose your
 * book" trust messaging already promises is safe) as one JSON document a
 * merchant can keep or hand to an accountant. Excludes bulky derived
 * history (StockMovement, AuditLog) that's reconstructable from the records
 * here, not a merchant's actual book.
 */
export async function buildCompanyBackup(db: ScopedTx, companyId: string) {
  const [company, products, branches, warehouses, branchStocks, warehouseStocks, customers, sales, expenses] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true, businessType: true, createdAt: true } }),
    db.product.findMany({ orderBy: { name: "asc" } }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    db.branchStock.findMany({ include: { product: { select: { sku: true, name: true } }, branch: { select: { name: true } } } }),
    db.warehouseStock.findMany({ include: { product: { select: { sku: true, name: true } }, warehouse: { select: { name: true } } } }),
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.sale.findMany({
      orderBy: { createdAt: "asc" },
      include: { lineItems: true, payments: true, creditNotes: true },
    }),
    db.expense.findMany({ orderBy: { expenseDate: "asc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    company,
    products,
    branches,
    warehouses,
    branchStocks,
    warehouseStocks,
    customers,
    sales,
    expenses,
  };
}
