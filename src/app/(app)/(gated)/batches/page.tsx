import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Badge, EmptyState } from "@/components/ui";
import { PackageSearch } from "lucide-react";

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
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view batches.</p>;
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
      <PageHeader title="Batches" description="Perishable and batch-tracked stock, by expiry date." />

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/batches?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 font-medium ${
              tab === t.key
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {batches.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No batches to show" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Location</TableHeaderCell>
            <TableHeaderCell>Batch #</TableHeaderCell>
            <TableHeaderCell>Expiry</TableHeaderCell>
            <TableHeaderCell>Remaining</TableHeaderCell>
          </TableHeader>
          <TableBody>
            {batches.map((b) => {
              const isExpired = b.expiryDate < now;
              const daysLeft = Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86_400_000);
              return (
                <TableRow key={b.id}>
                  <TableCell>
                    {b.product.name} <span className="font-mono text-xs text-gray-400 dark:text-gray-500">({b.product.sku})</span>
                  </TableCell>
                  <TableCell>
                    {b.branch ? (
                      b.branch.name
                    ) : (
                      <>
                        {b.warehouse!.name} <Badge variant="neutral">warehouse</Badge>
                      </>
                    )}
                  </TableCell>
                  <TableCell mono>{b.batchNumber}</TableCell>
                  <TableCell>
                    <Badge variant={isExpired ? "danger" : daysLeft <= 3 ? "warning" : "neutral"}>
                      {b.expiryDate.toLocaleDateString()} {isExpired ? "(expired)" : `(${daysLeft}d)`}
                    </Badge>
                  </TableCell>
                  <TableCell mono>{b.quantityRemaining}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
