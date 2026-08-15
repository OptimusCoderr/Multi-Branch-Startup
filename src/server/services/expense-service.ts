import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedClient = Pick<ReturnType<typeof getScopedPrisma>, "expense">;

/** Sum of non-voided expenses recorded on or after `since`. */
export async function getExpenseTotalSince(db: ScopedClient, since: Date): Promise<Prisma.Decimal> {
  const result = await db.expense.aggregate({
    where: { expenseDate: { gte: since }, voidedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
