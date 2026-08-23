import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, handleApiError } from "@/lib/api/mobile-auth";
import { getCustomerBalances } from "@/server/services/customer-service";
import { getPeriodSummary, startOfToday } from "@/server/services/report-service";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    const db = getScopedPrisma(membership.companyId);

    const [today, customers] = await Promise.all([
      getPeriodSummary(db, startOfToday()),
      db.customer.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    const balances = await getCustomerBalances(db, customers.map((c) => c.id));
    const totalOutstanding = [...balances.values()].reduce((sum, b) => sum.add(b.outstanding), new Prisma.Decimal(0));

    return NextResponse.json({
      companyName: membership.companyName,
      companyCurrency: membership.companyCurrency,
      todaysSalesCount: today.saleCount,
      todaysSalesTotal: today.revenue.toString(),
      todaysExpensesTotal: today.expenses.toString(),
      todaysProfit: today.profit.toString(),
      totalOutstandingDebt: totalOutstanding.toString(),
      debtorCount: [...balances.values()].filter((b) => b.outstanding.gt(0)).length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
