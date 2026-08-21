import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-indigo-100 text-indigo-700",
  RECEIVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function TransfersPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const transfers = await db.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true, sourceWarehouse: true, sourceBranch: true, destinationBranch: true, destinationWarehouse: true },
    take: 100,
  });

  const canRequest = permissions.has(PERMISSIONS.TRANSFERS_REQUEST);
  const canReceiveExternal = permissions.has(PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock transfers</h1>
        <div className="flex gap-2">
          {canReceiveExternal && (
            <Link
              href="/transfers/new-external"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Record external delivery
            </Link>
          )}
          {canRequest && (
            <Link href="/transfers/new" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
              Request transfer
            </Link>
          )}
        </div>
      </div>

      {transfers.length === 0 ? (
        <p className="text-gray-500">No transfers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{t.product.name}</td>
                  <td className="py-2 pr-4 font-mono">{t.quantity}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {t.sourceType === "EXTERNAL"
                      ? `External: ${t.externalSourceName}`
                      : t.sourceType === "BRANCH"
                        ? t.sourceBranch?.name
                        : t.sourceWarehouse?.name}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {t.destinationBranch ? t.destinationBranch.name : `${t.destinationWarehouse!.name} (warehouse)`}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[t.status] ?? ""}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/transfers/${t.id}`} className="text-[var(--brand-primary)] hover:underline">
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
