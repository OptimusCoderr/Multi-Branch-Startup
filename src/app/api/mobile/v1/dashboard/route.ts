import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, handleApiError } from "@/lib/api/mobile-auth";
import { getCustomerBalances } from "@/server/services/customer-service";
import { startOfToday } from "@/server/services/report-service";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    const db = getScopedPrisma(membership.companyId);

    const [todaysSales, customers] = await Promise.all([
      db.sale.findMany({
        where: { createdAt: { gte: startOfToday() }, status: { not: "VOIDED" } },
        select: { grandTotal: true },
      }),
      db.customer.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    const balances = await getCustomerBalances(db, customers.map((c) => c.id));
    const totalOutstanding = [...balances.values()].reduce((sum, b) => sum.add(b.outstanding), new Prisma.Decimal(0));
    const todaysSalesTotal = todaysSales.reduce((sum, s) => sum.add(s.grandTotal), new Prisma.Decimal(0));

    return NextResponse.json({
      companyName: membership.companyName,
      companyCurrency: membership.companyCurrency,
      todaysSalesCount: todaysSales.length,
      todaysSalesTotal: todaysSalesTotal.toString(),
      totalOutstandingDebt: totalOutstanding.toString(),
      debtorCount: [...balances.values()].filter((b) => b.outstanding.gt(0)).length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
