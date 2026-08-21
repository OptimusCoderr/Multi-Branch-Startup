import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedClient = Pick<ReturnType<typeof getScopedPrisma>, "sale" | "creditNote" | "expense">;

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type PeriodSummary = {
  revenue: Prisma.Decimal;
  collected: Prisma.Decimal;
  creditedTotal: Prisma.Decimal;
  saleCount: number;
  expenses: Prisma.Decimal;
  profit: Prisma.Decimal;
};

/**
 * Revenue/collected/credited/expenses/profit for a period. `since: null`
 * means all-time. Revenue is what was sold (Sale.grandTotal), not what
 * was collected — the same "revenue vs. cash" distinction every other
 * financial view in this app already draws (outstanding debt is reported
 * separately, as a current snapshot, not a period metric — see
 * getOutstandingDebt() below).
 */
export async function getPeriodSummary(db: ScopedClient, since: Date | null): Promise<PeriodSummary> {
  const dateFilter = since ? { gte: since } : undefined;

  const [saleAgg, creditAgg, expenseAgg] = await Promise.all([
    db.sale.aggregate({
      where: { status: { not: "VOIDED" }, ...(dateFilter && { createdAt: dateFilter }) },
      _sum: { grandTotal: true, amountPaid: true },
      _count: true,
    }),
    db.creditNote.aggregate({
      where: { status: "ISSUED", ...(dateFilter && { createdAt: dateFilter }) },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { voidedAt: null, ...(dateFilter && { expenseDate: dateFilter }) },
      _sum: { amount: true },
    }),
  ]);

  const revenue = saleAgg._sum.grandTotal ?? new Prisma.Decimal(0);
  const expenses = expenseAgg._sum.amount ?? new Prisma.Decimal(0);

  return {
    revenue,
    collected: saleAgg._sum.amountPaid ?? new Prisma.Decimal(0),
    creditedTotal: creditAgg._sum.amount ?? new Prisma.Decimal(0),
    saleCount: saleAgg._count,
    expenses,
    profit: revenue.sub(expenses),
  };
}

/**
 * Total money currently owed across every open sale, company-wide — a
 * snapshot of the present, not a period metric (same reasoning as
 * customer-service.ts's per-customer balance, just summed company-wide
 * instead of grouped by customer).
 */
export async function getOutstandingDebt(db: ScopedClient): Promise<Prisma.Decimal> {
  const sales = await db.sale.findMany({
    where: { status: { not: "VOIDED" } },
    select: { id: true, grandTotal: true, amountPaid: true },
  });
  if (sales.length === 0) return new Prisma.Decimal(0);

  const creditNotes = await db.creditNote.findMany({
    where: { saleId: { in: sales.map((s) => s.id) }, status: "ISSUED" },
    select: { saleId: true, amount: true },
  });
  const creditedBySaleId = new Map<string, Prisma.Decimal>();
  for (const cn of creditNotes) {
    creditedBySaleId.set(cn.saleId, (creditedBySaleId.get(cn.saleId) ?? new Prisma.Decimal(0)).add(cn.amount));
  }

  let total = new Prisma.Decimal(0);
  for (const sale of sales) {
    const credited = creditedBySaleId.get(sale.id) ?? new Prisma.Decimal(0);
    const outstandingOnSale = sale.grandTotal.sub(sale.amountPaid).sub(credited);
    if (outstandingOnSale.gt(0)) total = total.add(outstandingOnSale);
  }
  return total;
}

export type TopProduct = { productId: string; name: string; sku: string; quantitySold: number; revenue: Prisma.Decimal };

/**
 * Best-selling products by revenue in a period (null = all-time), from
 * non-voided sales' line items. Deliberately queries through Sale (which
 * has companyId and is tenant-scoped) with a nested select, never
 * db.saleLineItem directly — SaleLineItem has no companyId column of its
 * own and isn't in TENANT_SCOPED_MODELS, so a top-level query against it
 * would silently run unscoped across every company's data.
 */
export async function getTopProductsByRevenue(db: ScopedClient, since: Date | null, limit = 5): Promise<TopProduct[]> {
  const sales = await db.sale.findMany({
    where: { status: { not: "VOIDED" }, ...(since && { createdAt: { gte: since } }) },
    select: { lineItems: { select: { quantity: true, lineTotal: true, product: { select: { id: true, name: true, sku: true } } } } },
  });
  const lineItems = sales.flatMap((s) => s.lineItems);

  const byProduct = new Map<string, TopProduct>();
  for (const li of lineItems) {
    const existing = byProduct.get(li.product.id);
    if (existing) {
      existing.quantitySold += li.quantity;
      existing.revenue = existing.revenue.add(li.lineTotal);
    } else {
      byProduct.set(li.product.id, {
        productId: li.product.id,
        name: li.product.name,
        sku: li.product.sku,
        quantitySold: li.quantity,
        revenue: li.lineTotal,
      });
    }
  }

  return [...byProduct.values()].sort((a, b) => b.revenue.comparedTo(a.revenue)).slice(0, limit);
}
