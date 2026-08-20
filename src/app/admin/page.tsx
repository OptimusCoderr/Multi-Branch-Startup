import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  TRIAL: "bg-blue-500/20 text-blue-300",
  ACTIVE: "bg-green-500/20 text-green-300",
  SUSPENDED: "bg-red-500/20 text-red-300",
  CANCELLED: "bg-gray-500/20 text-gray-400",
};

const SUBSCRIPTION_STYLES: Record<string, string> = {
  TRIALING: "bg-yellow-500/20 text-yellow-300",
  ACTIVE: "bg-green-500/20 text-green-300",
  PAST_DUE: "bg-amber-500/20 text-amber-300",
  CANCELLED: "bg-red-500/20 text-red-300",
  INCOMPLETE: "bg-gray-500/20 text-gray-400",
};

/**
 * Deliberately read-only: every value here comes straight off Company /
 * Subscription / counts, with no mutation affordance anywhere on this page.
 * A platform admin can see that a company exists and roughly how big it
 * is — not touch its data, not see inside a company's own sales/customers/
 * staff records. If that scope ever needs to widen, it should be a
 * conscious follow-up decision, not something that crept in here.
 */
export default async function AdminDashboardPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { branches: true, warehouses: true } },
      memberships: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });

  const totals = {
    companies: companies.length,
    active: companies.filter((c) => c.status === "ACTIVE" || c.status === "TRIAL").length,
    staff: companies.reduce((sum, c) => sum + c.memberships.length, 0),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Companies</h1>
        <p className="mt-1 text-sm text-gray-400">
          {totals.companies} companies · {totals.active} active/trialing · {totals.staff} staff seats total
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Branches</th>
              <th className="px-4 py-3">Warehouses</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-b border-gray-900 last:border-0">
                <td className="px-4 py-3 font-medium">{company.name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[company.status] ?? ""}`}>
                    {company.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {company.subscription
                    ? `${company.subscription.plan.name} (${formatMoney(company.subscription.plan.priceKobo / 100, "NGN")}/mo)`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {company.subscription ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${SUBSCRIPTION_STYLES[company.subscription.status] ?? ""}`}>
                      {company.subscription.status.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-gray-500">No subscription</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-gray-300">{company._count.branches}</td>
                <td className="px-4 py-3 font-mono text-gray-300">{company._count.warehouses}</td>
                <td className="px-4 py-3 font-mono text-gray-300">{company.memberships.length}</td>
                <td className="px-4 py-3 text-gray-400">{company.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {companies.length === 0 && <p className="p-4 text-gray-500">No companies yet.</p>}
      </div>
    </div>
  );
}
