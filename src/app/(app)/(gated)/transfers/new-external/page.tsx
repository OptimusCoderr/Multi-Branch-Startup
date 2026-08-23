import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ReceiveExternalForm } from "@/components/forms/receive-external-form";

export default async function NewExternalDeliveryPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to record external deliveries.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [products, warehouses, branches] = await Promise.all([
    // An external delivery is physical stock arriving — SERVICE products
    // never have any.
    db.product.findMany({
      where: { isActive: true, productType: "GOODS" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, tracksBatches: true },
    }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Record an external delivery</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Stock delivered directly from a supplier, straight to a warehouse or a branch.
        </p>
      </div>
      <ReceiveExternalForm products={products} warehouses={warehouses} branches={branches} />
    </div>
  );
}
