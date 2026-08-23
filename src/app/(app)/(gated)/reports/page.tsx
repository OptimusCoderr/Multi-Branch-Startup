import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getPeriodSummary, getOutstandingDebt, getTopProductsByRevenue, startOfCurrentMonth, type PeriodSummary } from "@/server/services/report-service";
import { PageHeader, Card, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui";

function SummaryCard({ title, summary, currency }: { title: string; summary: PeriodSummary; currency: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</p>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Revenue ({summary.saleCount} sale{summary.saleCount === 1 ? "" : "s"})</span>
          <span className="font-medium">{formatMoney(summary.revenue.toString(), currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Collected</span>
          <span>{formatMoney(summary.collected.toString(), currency)}</span>
        </div>
        {summary.creditedTotal.gt(0) && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Credited</span>
            <span>{formatMoney(summary.creditedTotal.toString(), currency)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Expenses</span>
          <span>{formatMoney(summary.expenses.toString(), currency)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2 text-base font-semibold">
          <span>Profit</span>
          <span className={summary.profit.lt(0) ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
            {formatMoney(summary.profit.toString(), currency)}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default async function ReportsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.REPORTS_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view reports.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const [thisMonth, allTime, outstanding, topProducts] = await Promise.all([
    getPeriodSummary(db, startOfCurrentMonth()),
    getPeriodSummary(db, null),
    getOutstandingDebt(db),
    getTopProductsByRevenue(db, null, 5),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Revenue is what was sold, not necessarily collected — outstanding debt is shown separately below."
      />

      <Card variant="warning">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Outstanding debt (all customers, right now)</p>
        <p className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-300">{formatMoney(outstanding.toString(), currency)}</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard title="This month" summary={thisMonth} currency={currency} />
        <SummaryCard title="All time" summary={allTime} currency={currency} />
      </div>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Top products by revenue (all time)</p>
        {topProducts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No sales yet.</p>
        ) : (
          <div className="mt-3">
            <Table>
              <TableHeader>
                <TableHeaderCell>Product</TableHeaderCell>
                <TableHeaderCell>Qty sold</TableHeaderCell>
                <TableHeaderCell align="right">Revenue</TableHeaderCell>
              </TableHeader>
              <TableBody>
                {topProducts.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>
                      {p.name} <span className="font-mono text-xs text-gray-400 dark:text-gray-500">({p.sku})</span>
                    </TableCell>
                    <TableCell mono>{p.quantitySold}</TableCell>
                    <TableCell align="right">{formatMoney(p.revenue.toString(), currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
