import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";

const TABS = [
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function BatchesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "expiring";

  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.STOCK_LEVELS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view batches.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  const where =
    tab === "expired"
      ? { quantityRemaining: { gt: 0 }, expiryDate: { lt: now } }
      : tab === "all"
        ? { quantityRemaining: { gt: 0 } }
        : { quantityRemaining: { gt: 0 }, expiryDate: { lte: soon } };

  const batches = await db.productBatch.findMany({
    where,
    orderBy: { expiryDate: "asc" },
    include: {
      product: { select: { name: true, sku: true } },
      branch: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Batches</h1>
        <p className="mt-1 text-sm text-gray-500">Perishable and batch-tracked stock, by expiry date.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/batches?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 font-medium ${
              tab === t.key
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {batches.length === 0 ? (
        <p className="text-gray-500">No batches to show.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Batch #</th>
                <th className="py-2 pr-4">Expiry</th>
                <th className="py-2 pr-4">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const isExpired = b.expiryDate < now;
                const daysLeft = Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86_400_000);
                return (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      {b.product.name} <span className="font-mono text-xs text-gray-400">({b.product.sku})</span>
                    </td>
                    <td className="py-2 pr-4">
                      {b.branch ? (
                        b.branch.name
                      ) : (
                        <>
                          {b.warehouse!.name}{" "}
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">warehouse</span>
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{b.batchNumber}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          isExpired ? "bg-red-100 text-red-700" : daysLeft <= 3 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {b.expiryDate.toLocaleDateString()} {isExpired ? "(expired)" : `(${daysLeft}d)`}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono">{b.quantityRemaining}</td>
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
