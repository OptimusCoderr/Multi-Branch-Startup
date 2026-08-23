"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { submitSalesReportSchema, respondSalesReportSchema } from "@/lib/validation/sales-report.schema";
import * as salesReportService from "@/server/services/sales-report-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof salesReportService.SalesReportStateError || err instanceof salesReportService.SalesReportNotFoundError) {
    return err.message;
  }
  return fallback;
}

export async function submitDailySalesReport(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SALES_REPORTS_SUBMIT);

  const parsed = submitSalesReportSchema.safeParse({
    branchId: formData.get("branchId"),
    declaredCash: formData.get("declaredCash"),
    staffNote: formData.get("staffNote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid report details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();
  let reportId = "";

  try {
    await db.$transaction(async (tx) => {
      const report = await salesReportService.submitDailySalesReport(tx, membership.companyId, membership.membershipId, parsed.data.branchId, {
        declaredCash: parsed.data.declaredCash !== undefined ? new Prisma.Decimal(parsed.data.declaredCash) : undefined,
        staffNote: parsed.data.staffNote,
      });
      reportId = report.id;

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
        },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not submit the report.") };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/reports");
  redirect(`/sales/reports/${reportId}`);
}

export async function respondToDailySalesReport(reportId: string, _prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SALES_REPORTS_APPROVE);

  const parsed = respondSalesReportSchema.safeParse({
    action: formData.get("action"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid response." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const auditAction =
    parsed.data.action === "APPROVE" ? "sales_report.approved" : parsed.data.action === "SEND_BACK" ? "sales_report.sent_back" : "sales_report.rejected";

  try {
    await db.$transaction(async (tx) => {
      const report = await salesReportService.respondToDailySalesReport(tx, membership.membershipId, reportId, parsed.data.action, parsed.data.note);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: auditAction,
        entityType: "DailySalesReport",
        entityId: report.id,
        metadata: { note: parsed.data.note ?? null },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not respond to the report.") };
  }

  revalidatePath("/sales/reports");
  revalidatePath(`/sales/reports/${reportId}`);
  redirect(`/sales/reports/${reportId}`);
}
