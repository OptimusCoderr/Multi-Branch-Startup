import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getCustomerBalance } from "@/server/services/customer-service";
import { CustomerForm } from "@/components/forms/customer-form";
import { updateCustomer, archiveCustomer } from "@/server/actions/customers";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-yellow-100 text-yellow-700",
  PARTIALLY_PAID: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  VOIDED: "bg-gray-100 text-gray-500",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.CUSTOMERS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view customers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [balance, sales] = await Promise.all([
    getCustomerBalance(db, customer.id),
    db.sale.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: { branch: true },
      take: 50,
    }),
  ]);

  const canManage = permissions.has(PERMISSIONS.CUSTOMERS_MANAGE);
  const now = new Date();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {customer.phone ?? "No phone"} {customer.email ? `· ${customer.email}` : ""}
          </p>
        </div>
        {canManage && (
          <form action={archiveCustomer.bind(null, customer.id)}>
            <button type="submit" className="text-sm text-red-600 hover:underline">
              {customer.isActive ? "Archive" : "Reactivate"}
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Outstanding balance</p>
          <p className={`mt-1 text-xl font-semibold ${balance.outstanding.gt(0) ? "text-amber-700" : ""}`}>
            {formatMoney(balance.outstanding.toString(), currency)}
          </p>
          {balance.overdueSaleCount > 0 && (
            <p className="mt-1 text-xs font-medium text-red-600">{balance.overdueSaleCount} sale(s) overdue</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Open sales</p>
          <p className="mt-1 text-xl font-semibold">{balance.openSaleCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Sales history</p>
        {sales.length === 0 ? (
          <p className="text-sm text-gray-400">No sales linked to this customer yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="pb-1">Invoice</th>
                <th className="pb-1">Branch</th>
                <th className="pb-1">Total</th>
                <th className="pb-1">Outstanding</th>
                <th className="pb-1">Due</th>
                <th className="pb-1">Status</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const outstanding = s.grandTotal.sub(s.amountPaid);
                const overdue = outstanding.gt(0) && s.dueDate && s.dueDate < now;
                return (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-1 font-mono text-xs">{s.saleNumber}</td>
                    <td className="py-1">{s.branch.name}</td>
                    <td className="py-1">{formatMoney(s.grandTotal.toString(), currency)}</td>
                    <td className="py-1">
                      {outstanding.gt(0) ? (
                        <span className={overdue ? "font-medium text-red-600" : "text-amber-700"}>
                          {formatMoney(outstanding.toString(), currency)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1 text-gray-500">{s.dueDate ? s.dueDate.toLocaleDateString() : "—"}</td>
                    <td className="py-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[s.status] ?? ""}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-1 text-right">
                      <Link href={`/sales/${s.id}`} className="text-[var(--brand-primary)] hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Edit customer</h2>
          <CustomerForm
            action={updateCustomer.bind(null, customer.id)}
            defaultValues={{
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              notes: customer.notes,
              creditLimit: customer.creditLimit?.toString() ?? null,
            }}
            submitLabel="Save changes"
          />
        </div>
      )}
    </div>
  );
}
