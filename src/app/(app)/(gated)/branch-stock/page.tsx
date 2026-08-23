import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, EmptyState } from "@/components/ui";
import { BranchStockPageClient } from "@/components/branch-stock/branch-stock-page-client";
import { Building2 } from "lucide-react";

export default async function BranchStockPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.STOCK_LEVELS_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view stock levels.</p>;
  }

  const db = getScopedPrisma(membership.companyId);

  const branches = await db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  if (branches.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Branch Stock" />
        <EmptyState
          icon={Building2}
          title="No branches yet"
          description="Branch stock is tracked per branch — create a branch first from the Branches page."
        />
      </div>
    );
  }

  const { branch: requestedBranchId } = await searchParams;
  const selectedBranchId = branches.some((b) => b.id === requestedBranchId) ? requestedBranchId! : branches[0].id;

  const [stockRows, pendingTransfers, historyTransfers, myRequests, products, warehouses] = await Promise.all([
    db.branchStock.findMany({
      where: { branchId: selectedBranchId },
      include: { product: { select: { id: true, name: true, sku: true, category: true, unitLabel: true, unitPrice: true } } },
      orderBy: { product: { name: "asc" } },
    }),
    db.stockTransfer.findMany({
      where: { destinationBranchId: selectedBranchId, status: { in: ["REQUESTED", "APPROVED", "IN_TRANSIT"] } },
      include: { product: true, sourceBranch: true, sourceWarehouse: true },
      orderBy: { requestedAt: "desc" },
    }),
    db.stockTransfer.findMany({
      where: { destinationBranchId: selectedBranchId, status: { in: ["RECEIVED", "REJECTED", "CANCELLED"] } },
      include: { product: true, sourceBranch: true, sourceWarehouse: true },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
    db.stockTransfer.findMany({
      where: { requestedByMembershipId: membership.membershipId },
      include: { product: true, sourceBranch: true, sourceWarehouse: true, destinationBranch: true, destinationWarehouse: true },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, tracksBatches: true } }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const otherBranches = branches.filter((b) => b.id !== selectedBranchId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Branch Stock" />
      <BranchStockPageClient
        membershipId={membership.membershipId}
        branches={branches}
        selectedBranchId={selectedBranchId}
        otherBranches={otherBranches}
        warehouses={warehouses}
        products={products}
        currency={membership.companyCurrency}
        stockRows={stockRows.map((s) => ({
          productId: s.product.id,
          productName: s.product.name,
          productSku: s.product.sku,
          category: s.product.category,
          unitLabel: s.product.unitLabel,
          unitPrice: s.product.unitPrice.toString(),
          quantity: s.quantity,
        }))}
        pendingTransfers={pendingTransfers.map(serializeTransfer)}
        historyTransfers={historyTransfers.map(serializeTransfer)}
        myRequests={myRequests.map((t) => ({
          ...serializeTransfer(t),
          destinationLabel: t.destinationBranch ? t.destinationBranch.name : `${t.destinationWarehouse!.name} (warehouse)`,
        }))}
        permissions={{
          canView: permissions.has(PERMISSIONS.STOCK_LEVELS_VIEW),
          canRequest: permissions.has(PERMISSIONS.TRANSFERS_REQUEST),
          canApprove: permissions.has(PERMISSIONS.TRANSFERS_APPROVE),
          canDispatch: permissions.has(PERMISSIONS.TRANSFERS_DISPATCH),
          canReceive: permissions.has(PERMISSIONS.TRANSFERS_RECEIVE),
          canReceiveExternal: permissions.has(PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL),
          canAdjustDirectly: permissions.has(PERMISSIONS.BRANCHES_MANAGE),
        }}
      />
    </div>
  );
}

function serializeTransfer(t: {
  id: string;
  productId: string;
  quantity: number;
  status: string;
  sourceType: string | null;
  externalSourceName: string | null;
  sourceBranch: { name: string } | null;
  sourceWarehouse: { name: string } | null;
  requestedByMembershipId: string;
  requestedAt: Date;
  receivedQuantity: number | null;
  rejectionReason: string | null;
  dispatchedBatches: unknown;
  product: { name: string; tracksBatches: boolean };
}) {
  return {
    id: t.id,
    productId: t.productId,
    productName: t.product.name,
    productTracksBatches: t.product.tracksBatches,
    quantity: t.quantity,
    status: t.status,
    sourceLabel:
      t.sourceType === "EXTERNAL"
        ? `External: ${t.externalSourceName}`
        : t.sourceType === "BRANCH"
          ? (t.sourceBranch?.name ?? null)
          : t.sourceType === "WAREHOUSE"
            ? (t.sourceWarehouse?.name ?? null)
            : null,
    requestedByMembershipId: t.requestedByMembershipId,
    requestedAt: t.requestedAt.toISOString(),
    receivedQuantity: t.receivedQuantity,
    rejectionReason: t.rejectionReason,
    carriedBatchCount: Array.isArray(t.dispatchedBatches) ? t.dispatchedBatches.length : 0,
  };
}
