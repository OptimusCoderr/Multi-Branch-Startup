import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  PageHeader,
  StatCard,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  LinkButton,
  EmptyState,
  type BadgeVariant,
} from "@/components/ui";
import { ClipboardList, FileEdit, Truck, PackageCheck } from "lucide-react";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ORDERED: "warning",
  PARTIALLY_RECEIVED: "brand",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default async function PurchaseOrdersPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PURCHASE_ORDERS_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view purchase orders.</p>;
  }

  const db = getScopedPrisma(membership.companyId);

  const purchaseOrders = await db.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: true, destinationBranch: true, destinationWarehouse: true, lineItems: true },
    take: 100,
  });

  const canManage = permissions.has(PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  const draftCount = purchaseOrders.filter((po) => po.status === "DRAFT").length;
  const orderedCount = purchaseOrders.filter((po) => po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED").length;
  const receivedCount = purchaseOrders.filter((po) => po.status === "RECEIVED").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase orders"
        actions={
          <>
            <LinkButton href="/suppliers" variant="secondary">
              Manage suppliers
            </LinkButton>
            {canManage && <LinkButton href="/purchase-orders/new">New purchase order</LinkButton>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total" value={String(purchaseOrders.length)} tint="#6b7280" />
        <StatCard icon={FileEdit} label="Draft" value={String(draftCount)} tint="var(--brand-primary)" />
        <StatCard icon={Truck} label="Ordered" value={String(orderedCount)} tint="#d97706" />
        <StatCard icon={PackageCheck} label="Received" value={String(receivedCount)} tint="#16a34a" />
      </div>

      {purchaseOrders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No purchase orders yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>PO number</TableHeaderCell>
            <TableHeaderCell>Supplier</TableHeaderCell>
            <TableHeaderCell>Destination</TableHeaderCell>
            <TableHeaderCell>Lines</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell mono>{po.poNumber}</TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">
                  {po.destinationBranch ? po.destinationBranch.name : `${po.destinationWarehouse!.name} (warehouse)`}
                </TableCell>
                <TableCell mono>{po.lineItems.length}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[po.status] ?? "neutral"}>{po.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell align="right">
                  <LinkButton href={`/purchase-orders/${po.id}`} variant="link">
                    View
                  </LinkButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
