import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma, Prisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getCustomerBalances } from "@/server/services/customer-service";
import { archiveCustomer } from "@/server/actions/customers";

export default async function CustomersPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.CUSTOMERS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view customers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const customers = await db.customer.findMany({ orderBy: { name: "asc" } });
  const balances = await getCustomerBalances(db, customers.map((c) => c.id));

  const totalOutstanding = [...balances.values()].reduce((sum, b) => sum.add(b.outstanding), new Prisma.Decimal(0));

  const canCreate = permissions.has(PERMISSIONS.CUSTOMERS_MANAGE);
  const debtorCount = [...balances.values()].filter((b) => b.outstanding.gt(0)).length;
  const overdueCount = [...balances.values()].filter((b) => b.overdueSaleCount > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        {canCreate && (
          <Link href="/customers/new" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
            New customer
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Total outstanding</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(totalOutstanding.toString(), currency)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Debtors</p>
          <p className="mt-1 text-xl font-semibold">{debtorCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Overdue</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{overdueCount}</p>
        </div>
      </div>

      {customers.length === 0 ? (
        <p className="text-gray-500">No customers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Outstanding</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const balance = balances.get(c.id);
                const overdue = (balance?.overdueSaleCount ?? 0) > 0;
                return (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{c.phone ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {balance && balance.outstanding.gt(0) ? (
                        <span className={overdue ? "font-medium text-red-600" : "font-medium text-amber-700"}>
                          {formatMoney(balance.outstanding.toString(), currency)}
                          {overdue ? " (overdue)" : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <Link href={`/customers/${c.id}`} className="text-[var(--brand-primary)] hover:underline">
                          View
                        </Link>
                        {canCreate && (
                          <form action={archiveCustomer.bind(null, c.id)}>
                            <button type="submit" className="text-red-600 hover:underline">
                              {c.isActive ? "Archive" : "Reactivate"}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
