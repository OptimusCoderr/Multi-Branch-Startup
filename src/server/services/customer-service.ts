import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedClient = Pick<ReturnType<typeof getScopedPrisma>, "sale">;

export type CustomerBalance = {
  outstanding: Prisma.Decimal;
  openSaleCount: number;
  overdueSaleCount: number;
};

const ZERO_BALANCE: CustomerBalance = { outstanding: new Prisma.Decimal(0), openSaleCount: 0, overdueSaleCount: 0 };

/**
 * A customer's outstanding balance is never stored — it's always derived
 * fresh from Sale.grandTotal - Sale.amountPaid (the same source of truth
 * the sale detail page uses), so it can never drift from the payment
 * ledger the way a cached "debt" column could.
 */
export async function getCustomerBalances(db: ScopedClient, customerIds: string[]): Promise<Map<string, CustomerBalance>> {
  const balances = new Map<string, CustomerBalance>();
  if (customerIds.length === 0) return balances;

  const sales = await db.sale.findMany({
    where: { customerId: { in: customerIds }, status: { not: "VOIDED" } },
    select: { customerId: true, grandTotal: true, amountPaid: true, dueDate: true },
  });

  const now = new Date();

  for (const sale of sales) {
    if (!sale.customerId) continue;
    const outstandingOnSale = sale.grandTotal.sub(sale.amountPaid);
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
