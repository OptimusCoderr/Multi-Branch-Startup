import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CreatePurchaseOrderForm } from "@/components/forms/create-purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PURCHASE_ORDERS_MANAGE)) {
    return <p className="text-gray-500">You don&apos;t have permission to create purchase orders.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [suppliers, products, warehouses, branches, company] = await Promise.all([
    db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.company.findUnique({ where: { id: membership.companyId }, select: { currency: true } }),
  ]);

  if (suppliers.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold">New purchase order</h1>
        <p className="text-gray-500">
          You need at least one supplier before creating a purchase order.{" "}
          <Link href="/suppliers/new" className="text-[var(--brand-primary)] hover:underline">
            Add a supplier
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  if (warehouses.length === 0 && branches.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold">New purchase order</h1>
        <p className="text-gray-500">You need at least one branch or warehouse to receive stock into before creating a purchase order.</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New purchase order</h1>
      <CreatePurchaseOrderForm
        suppliers={suppliers}
        products={products}
        warehouses={warehouses}
        branches={branches}
        currency={company?.currency ?? "NGN"}
      />
    </div>
  );
}
