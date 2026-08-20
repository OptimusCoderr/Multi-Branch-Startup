import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedClient = Pick<ReturnType<typeof getScopedPrisma>, "sale" | "creditNote">;

export type CustomerBalance = {
  outstanding: Prisma.Decimal;
  openSaleCount: number;
  overdueSaleCount: number;
};

const ZERO_BALANCE: CustomerBalance = { outstanding: new Prisma.Decimal(0), openSaleCount: 0, overdueSaleCount: 0 };

/**
 * A customer's outstanding balance is never stored — it's always derived
 * fresh from Sale.grandTotal - Sale.amountPaid - (issued CreditNotes
 * against that sale) (the same source of truth the sale detail page
 * uses), so it can never drift from the payment/credit-note ledgers the
 * way a cached "debt" column could.
 */
export async function getCustomerBalances(db: ScopedClient, customerIds: string[]): Promise<Map<string, CustomerBalance>> {
  const balances = new Map<string, CustomerBalance>();
  if (customerIds.length === 0) return balances;

  const sales = await db.sale.findMany({
    where: { customerId: { in: customerIds }, status: { not: "VOIDED" } },
    select: { id: true, customerId: true, grandTotal: true, amountPaid: true, dueDate: true },
  });
  if (sales.length === 0) return balances;

  const creditNotes = await db.creditNote.findMany({
    where: { saleId: { in: sales.map((s) => s.id) }, status: "ISSUED" },
    select: { saleId: true, amount: true },
  });
  const creditedBySaleId = new Map<string, Prisma.Decimal>();
  for (const cn of creditNotes) {
    creditedBySaleId.set(cn.saleId, (creditedBySaleId.get(cn.saleId) ?? new Prisma.Decimal(0)).add(cn.amount));
  }

  const now = new Date();

  for (const sale of sales) {
    if (!sale.customerId) continue;
    const credited = creditedBySaleId.get(sale.id) ?? new Prisma.Decimal(0);
    const outstandingOnSale = sale.grandTotal.sub(sale.amountPaid).sub(credited);
    if (outstandingOnSale.lte(0)) continue;

    const current = balances.get(sale.customerId) ?? { ...ZERO_BALANCE };
    current.outstanding = current.outstanding.add(outstandingOnSale);
    current.openSaleCount += 1;
    if (sale.dueDate && sale.dueDate < now) {
      current.overdueSaleCount += 1;
    }
    balances.set(sale.customerId, current);
  }

  return balances;
}

export async function getCustomerBalance(db: ScopedClient, customerId: string): Promise<CustomerBalance> {
  const balances = await getCustomerBalances(db, [customerId]);
  return balances.get(customerId) ?? ZERO_BALANCE;
}
