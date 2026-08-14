import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-yellow-100 text-yellow-700",
  PARTIALLY_PAID: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  VOIDED: "bg-gray-100 text-gray-500",
};

export default async function SalesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const sales = await db.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: { branch: true },
    take: 100,
  });

  const canRecord = permissions.has(PERMISSIONS.SALES_RECORD);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sales</h1>
        {canRecord && (
          <Link href="/sales/new" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
            New sale
          </Link>
        )}
      </div>

      {sales.length === 0 ? (
        <p className="text-gray-500">No sales yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Branch</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Paid</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs">{s.saleNumber}</td>
                  <td className="py-2 pr-4">{s.branch.name}</td>
                  <td className="py-2 pr-4 text-gray-500">{s.customerName ?? "—"}</td>
                  <td className="py-2 pr-4">{formatMoney(s.grandTotal.toString(), membership.companyCurrency)}</td>
                  <td className="py-2 pr-4">{formatMoney(s.amountPaid.toString(), membership.companyCurrency)}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[s.status] ?? ""}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/sales/${s.id}`} className="text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
