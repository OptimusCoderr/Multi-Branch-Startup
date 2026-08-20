import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getPeriodSummary, getOutstandingDebt, getTopProductsByRevenue, startOfCurrentMonth, type PeriodSummary } from "@/server/services/report-service";

function SummaryCard({ title, summary, currency }: { title: string; summary: PeriodSummary; currency: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-semibold uppercase text-gray-400">{title}</p>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Revenue ({summary.saleCount} sale{summary.saleCount === 1 ? "" : "s"})</span>
          <span className="font-medium">{formatMoney(summary.revenue.toString(), currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Collected</span>
          <span>{formatMoney(summary.collected.toString(), currency)}</span>
        </div>
        {summary.creditedTotal.gt(0) && (
          <div className="flex justify-between">
            <span className="text-gray-500">Credited</span>
            <span>{formatMoney(summary.creditedTotal.toString(), currency)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Expenses</span>
          <span>{formatMoney(summary.expenses.toString(), currency)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-100 pt-2 text-base font-semibold">
          <span>Profit</span>
          <span className={summary.profit.lt(0) ? "text-red-600" : "text-green-700"}>
            {formatMoney(summary.profit.toString(), currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function ReportsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.REPORTS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view reports.</p>;
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
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Revenue is what was sold, not necessarily collected — outstanding debt is shown separately below.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase text-amber-700">Outstanding debt (all customers, right now)</p>
        <p className="mt-1 text-2xl font-semibold text-amber-800">{formatMoney(outstanding.toString(), currency)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard title="This month" summary={thisMonth} currency={currency} />
        <SummaryCard title="All time" summary={allTime} currency={currency} />
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-semibold uppercase text-gray-400">Top products by revenue (all time)</p>
        {topProducts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No sales yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Qty sold</th>
                <th className="py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.productId} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4">
                    {p.name} <span className="font-mono text-xs text-gray-400">({p.sku})</span>
                  </td>
                  <td className="py-2 pr-4 font-mono">{p.quantitySold}</td>
                  <td className="py-2 text-right">{formatMoney(p.revenue.toString(), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
