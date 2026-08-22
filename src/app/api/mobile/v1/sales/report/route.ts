import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveBusinessDay, businessDayToDate } from "@/lib/business-day";
import { submitSalesReportSchema } from "@/lib/validation/sales-report.schema";
import * as salesReportService from "@/server/services/sales-report-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET returns, per active branch, today's live totals for the caller
 * (mirrors the web /sales/reports/new preview) plus whether a report for
 * today already exists there and its status, so the app can show "already
 * submitted — waiting on approval" instead of a blank form. POST submits
 * one, reusing the exact same service the web report form uses.
 */
export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_REPORTS_SUBMIT);

    const db = getScopedPrisma(membership.companyId);
    const [branches, company] = await Promise.all([
      db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.company.findUnique({ where: { id: membership.companyId }, select: { timezone: true } }),
    ]);

    const businessDay = resolveBusinessDay(company?.timezone ?? "Africa/Lagos");
    const reportDate = businessDayToDate(businessDay.dateKey);

    const existingReports = await db.dailySalesReport.findMany({
      where: { membershipId: membership.membershipId, reportDate, branchId: { in: branches.map((b) => b.id) } },
      select: { id: true, branchId: true, status: true },
    });
    const existingByBranch = new Map(existingReports.map((r) => [r.branchId, r]));

    const branchPreviews = await Promise.all(
      branches.map(async (b) => {
        const totals = await salesReportService.computeDailySalesReportTotals(db, membership.companyId, b.id, membership.membershipId, businessDay);
        const existing = existingByBranch.get(b.id);
        return {
          branchId: b.id,
          branchName: b.name,
          salesCount: totals.salesCount,
          grossSalesTotal: totals.grossSalesTotal.toString(),
          paymentsCollected: totals.paymentsCollected.toString(),
          cashCollected: totals.cashCollected.toString(),
          reportId: existing?.id ?? null,
          reportStatus: existing?.status ?? null,
        };
      }),
    );

    return NextResponse.json({ businessDate: businessDay.dateKey, branches: branchPreviews });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_REPORTS_SUBMIT);

    try {
      checkRateLimit(`sales_report.submit:${membership.membershipId}`, { max: 30, windowMs: 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = submitSalesReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid report details.", 400);
    }

    const db = getScopedPrisma(membership.companyId);
    let reportId = "";
    let reportStatus = "";

    await db.$transaction(async (tx) => {
      const report = await salesReportService.submitDailySalesReport(tx, membership.companyId, membership.membershipId, parsed.data.branchId, {
        declaredCash: parsed.data.declaredCash !== undefined ? new Prisma.Decimal(parsed.data.declaredCash) : undefined,
        staffNote: parsed.data.staffNote,
      });
      reportId = report.id;
      reportStatus = report.status;

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "sales_report.submitted",
        entityType: "DailySalesReport",
        entityId: report.id,
        metadata: {
          branchId: parsed.data.branchId,
          salesCount: report.salesCount,
          grossSalesTotal: report.grossSalesTotal.toString(),
          declaredCash: report.declaredCash?.toString() ?? null,
          cashDiscrepancy: report.cashDiscrepancy?.toString() ?? null,
          source: "mobile",
        },
      });
    });

    return NextResponse.json({ reportId, status: reportStatus }, { status: 201 });
  } catch (err) {
    return handleApiError(err, [salesReportService.SalesReportStateError, salesReportService.SalesReportNotFoundError]);
  }
}
