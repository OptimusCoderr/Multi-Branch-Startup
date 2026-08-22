import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

/** The caller's own report history — mobile has no approval UI, so unlike the web list this never shows other staff's reports. */
export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_REPORTS_SUBMIT);

    const db = getScopedPrisma(membership.companyId);
    const reports = await db.dailySalesReport.findMany({
      where: { membershipId: membership.membershipId },
      orderBy: { reportDate: "desc" },
      include: { branch: { select: { name: true } } },
      take: 50,
    });

    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        branchName: r.branch.name,
        reportDate: r.reportDate.toISOString().slice(0, 10),
        status: r.status,
        salesCount: r.salesCount,
        grossSalesTotal: r.grossSalesTotal.toString(),
        cashCollected: r.cashCollected.toString(),
        declaredCash: r.declaredCash?.toString() ?? null,
        cashDiscrepancy: r.cashDiscrepancy?.toString() ?? null,
        staffNote: r.staffNote,
        ownerNote: r.ownerNote,
        submittedAt: r.submittedAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
