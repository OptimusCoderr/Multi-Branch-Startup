import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { formatMoney } from "@/lib/format";
import {
  PageHeader,
  LinkButton,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
  type BadgeVariant,
} from "@/components/ui";
import { ClipboardCheck } from "lucide-react";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SUBMITTED: "warning",
  APPROVED: "success",
  SENT_BACK: "brand",
  REJECTED: "danger",
};

export default async function SalesReportsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  const canSubmit = permissions.has(PERMISSIONS.SALES_REPORTS_SUBMIT);
  const canViewAll = permissions.has(PERMISSIONS.SALES_REPORTS_VIEW);

  if (!canSubmit && !canViewAll) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view sales reports.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const reports = await db.dailySalesReport.findMany({
    where: canViewAll ? undefined : { membershipId: membership.membershipId },
    orderBy: { reportDate: "desc" },
    include: { branch: true },
    take: 100,
  });

  const names = await resolveMembershipNames(db, reports.map((r) => r.membershipId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Daily sales reports"
        description={canViewAll ? "Every staff member's submitted reports." : "Your submitted end-of-day reports."}
        actions={canSubmit && <LinkButton href="/sales/reports/new">Submit today&apos;s report</LinkButton>}
      />

      {reports.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No reports yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Branch</TableHeaderCell>
            {canViewAll && <TableHeaderCell>Staff</TableHeaderCell>}
            <TableHeaderCell>Sales</TableHeaderCell>
            <TableHeaderCell>Gross total</TableHeaderCell>
            <TableHeaderCell>Cash discrepancy</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell mono>{r.reportDate.toISOString().slice(0, 10)}</TableCell>
                <TableCell>{r.branch.name}</TableCell>
                {canViewAll && <TableCell className="text-gray-500 dark:text-gray-400">{names.get(r.membershipId) ?? "Unknown"}</TableCell>}
                <TableCell mono>{r.salesCount}</TableCell>
                <TableCell>{formatMoney(r.grossSalesTotal.toString(), membership.companyCurrency)}</TableCell>
                <TableCell className={r.cashDiscrepancy && !r.cashDiscrepancy.isZero() ? "font-medium text-amber-700 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}>
                  {r.cashDiscrepancy ? formatMoney(r.cashDiscrepancy.toString(), membership.companyCurrency) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell align="right">
                  <LinkButton href={`/sales/reports/${r.id}`} variant="link">
                    View
                  </LinkButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
