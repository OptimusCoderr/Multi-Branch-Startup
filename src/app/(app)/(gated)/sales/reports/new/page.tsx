import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveBusinessDay } from "@/lib/business-day";
import { computeDailySalesReportTotals } from "@/server/services/sales-report-service";
import { SubmitSalesReportForm } from "@/components/forms/submit-sales-report-form";

export default async function NewSalesReportPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SALES_REPORTS_SUBMIT)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to submit a sales report.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [branches, company] = await Promise.all([
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.company.findUnique({ where: { id: membership.companyId }, select: { currency: true, timezone: true } }),
  ]);

  if (branches.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold">Submit today&apos;s report</h1>
        <p className="text-gray-500 dark:text-gray-400">You need at least one branch before submitting a sales report.</p>
      </div>
    );
  }

  const businessDay = resolveBusinessDay(company?.timezone ?? "Africa/Lagos");
  const previews = await Promise.all(
    branches.map(async (b) => ({
      branchId: b.id,
      branchName: b.name,
      ...(await computeDailySalesReportTotals(db, membership.companyId, b.id, membership.membershipId, businessDay)),
    })),
  );

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">Submit today&apos;s report</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Covers {businessDay.dateKey} — sales and payments you personally recorded today, at the branch you pick below.
        Once submitted, you won&apos;t be able to record more sales at that branch today unless an Owner sends the
        report back.
      </p>
      <SubmitSalesReportForm
        previews={previews.map((p) => ({
          branchId: p.branchId,
          branchName: p.branchName,
          salesCount: p.salesCount,
          grossSalesTotal: p.grossSalesTotal.toString(),
          cashCollected: p.cashCollected.toString(),
          paymentsCollected: p.paymentsCollected.toString(),
        }))}
        currency={company?.currency ?? "NGN"}
      />
    </div>
  );
}
