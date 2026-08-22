import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { formatMoney } from "@/lib/format";
import { RespondSalesReportForm } from "@/components/forms/respond-sales-report-form";
import { PageHeader, Card, Badge, type BadgeVariant } from "@/components/ui";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SUBMITTED: "warning",
  APPROVED: "success",
  SENT_BACK: "brand",
  REJECTED: "danger",
};

export default async function SalesReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  const db = getScopedPrisma(membership.companyId);
  const report = await db.dailySalesReport.findUnique({ where: { id }, include: { branch: true } });
  if (!report) notFound();

  const canViewAll = permissions.has(PERMISSIONS.SALES_REPORTS_VIEW);
  const isOwn = report.membershipId === membership.membershipId;
  if (!canViewAll && !isOwn) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view this report.</p>;
  }

  const canApprove = permissions.has(PERMISSIONS.SALES_REPORTS_APPROVE);
  const currency = membership.companyCurrency;

  const names = await resolveMembershipNames(
    db,
    [report.membershipId, report.respondedByMembershipId].filter((m): m is string => Boolean(m)),
  );

  const hasDiscrepancy = report.cashDiscrepancy !== null && !report.cashDiscrepancy.isZero();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`${report.branch.name} — ${report.reportDate.toISOString().slice(0, 10)}`}
        description={`Submitted by ${names.get(report.membershipId) ?? "Unknown"}`}
        actions={<Badge variant={STATUS_VARIANTS[report.status] ?? "neutral"}>{report.status.replace("_", " ")}</Badge>}
      />

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Sales</p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{report.salesCount}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Gross total</p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(report.grossSalesTotal.toString(), currency)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Discounts</p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(report.discountTotal.toString(), currency)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Payments collected</p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(report.paymentsCollected.toString(), currency)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Cash collected (system)</p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(report.cashCollected.toString(), currency)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Cash declared (staff)</p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">
              {report.declaredCash !== null ? formatMoney(report.declaredCash.toString(), currency) : "—"}
            </p>
          </div>
        </div>
      </Card>

      {hasDiscrepancy && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Cash discrepancy: {formatMoney(report.cashDiscrepancy!.toString(), currency)} — the declared cash count doesn&apos;t match
            what the system recorded as collected in cash.
          </p>
        </Card>
      )}

      {report.staffNote && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Staff note</p>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{report.staffNote}</p>
        </div>
      )}

      {report.respondedAt && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
            {report.status === "APPROVED" ? "Approved" : report.status === "REJECTED" ? "Rejected" : "Sent back"} by
          </p>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
            {names.get(report.respondedByMembershipId ?? "") ?? "Unknown"} · {report.respondedAt.toLocaleString()}
          </p>
          {report.ownerNote && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">&ldquo;{report.ownerNote}&rdquo;</p>}
        </div>
      )}

      {canApprove && report.status === "SUBMITTED" && <RespondSalesReportForm reportId={report.id} />}
    </div>
  );
}
