import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { markPurchaseOrderOrdered, cancelPurchaseOrder } from "@/server/actions/purchase-orders";
import { ReceivePurchaseOrderLineItemForm } from "@/components/forms/receive-purchase-order-line-item-form";
import { formatMoney } from "@/lib/format";
import {
  PageHeader,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Button,
  type BadgeVariant,
} from "@/components/ui";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ORDERED: "warning",
  PARTIALLY_RECEIVED: "brand",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PURCHASE_ORDERS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view purchase orders.</p>;
  }

  const db = getScopedPrisma(membership.companyId);

  const [po, company] = await Promise.all([
    db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        destinationBranch: true,
        destinationWarehouse: true,
        lineItems: { include: { product: true } },
      },
    }),
    db.company.findUnique({ where: { id: membership.companyId }, select: { currency: true } }),
  ]);
  if (!po) notFound();

  const currency = company?.currency ?? "NGN";
  const names = await resolveMembershipNames(db, [
    po.createdByMembershipId,
    po.orderedByMembershipId,
    po.cancelledByMembershipId,
  ]);
  const nameOf = (mid: string | null) => (mid ? (names.get(mid) ?? "Unknown") : null);

  const canManage = permissions.has(PERMISSIONS.PURCHASE_ORDERS_MANAGE);
  const canReceive = permissions.has(PERMISSIONS.PURCHASE_ORDERS_RECEIVE);
  const canCancel = canManage && (po.status === "DRAFT" || po.status === "ORDERED") && po.lineItems.every((li) => li.quantityReceived === 0);
  const canReceiveNow = canReceive && (po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED");

  const totalCost = po.lineItems.reduce((sum, li) => sum + Number(li.unitCost) * li.quantityOrdered, 0);

  const events: { label: string; detail: string }[] = [
    { label: "Created", detail: `${nameOf(po.createdByMembershipId)} · ${po.createdAt.toLocaleString()}` },
  ];
  if (po.orderedAt) {
    events.push({ label: "Ordered", detail: `${nameOf(po.orderedByMembershipId)} · ${po.orderedAt.toLocaleString()}` });
  }
  if (po.cancelledAt) {
    events.push({ label: "Cancelled", detail: `${nameOf(po.cancelledByMembershipId)} · ${po.cancelledAt.toLocaleString()}` });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={po.poNumber}
        description={`${po.supplier.name} → ${po.destinationBranch ? po.destinationBranch.name : `${po.destinationWarehouse!.name} (warehouse)`}`}
        actions={<Badge variant={STATUS_VARIANTS[po.status] ?? "neutral"}>{po.status.replace("_", " ")}</Badge>}
      />

      {po.expectedDate && <p className="text-sm text-gray-500">Expected delivery: {po.expectedDate.toLocaleDateString()}</p>}
      {po.notes && <p className="text-sm text-gray-600">Notes: {po.notes}</p>}

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-semibold uppercase text-gray-400">Timeline</p>
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {events.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.label}:</span> {e.detail}
            </li>
          ))}
        </ol>
      </div>

      <Table>
        <TableHeader>
          <TableHeaderCell>Product</TableHeaderCell>
          <TableHeaderCell>Unit cost</TableHeaderCell>
          <TableHeaderCell>Ordered</TableHeaderCell>
          <TableHeaderCell>Received</TableHeaderCell>
          <TableHeaderCell>Remaining</TableHeaderCell>
          {canReceiveNow && <TableHeaderCell>Receive</TableHeaderCell>}
        </TableHeader>
        <TableBody>
          {po.lineItems.map((li) => {
            const remaining = li.quantityOrdered - li.quantityReceived;
            return (
              <TableRow key={li.id}>
                <TableCell>
                  {li.product.name} <span className="text-gray-400">({li.product.sku})</span>
                </TableCell>
                <TableCell mono>{formatMoney(li.unitCost.toString(), currency)}</TableCell>
                <TableCell mono>{li.quantityOrdered}</TableCell>
                <TableCell mono>{li.quantityReceived}</TableCell>
                <TableCell mono>{remaining}</TableCell>
                {canReceiveNow && (
                  <TableCell>
                    {remaining > 0 ? (
                      <ReceivePurchaseOrderLineItemForm
                        purchaseOrderId={po.id}
                        lineItemId={li.id}
                        remainingQuantity={remaining}
                        requiresBatch={li.product.tracksBatches}
                      />
                    ) : (
                      <span className="text-sm text-gray-400">Fully received</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex justify-end text-lg font-semibold">Total cost: {formatMoney(totalCost, currency)}</div>

      {(po.status === "DRAFT" || canCancel) && (
        <div className="flex gap-4">
          {po.status === "DRAFT" && canManage && (
            <form action={markPurchaseOrderOrdered.bind(null, po.id)}>
              <Button type="submit">Mark as ordered</Button>
            </form>
          )}
          {canCancel && (
            <form action={cancelPurchaseOrder.bind(null, po.id)}>
              <Button type="submit" variant="danger-link">
                Cancel purchase order
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
