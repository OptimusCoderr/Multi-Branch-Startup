import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ReceiveExternalForm } from "@/components/forms/receive-external-form";

export default async function NewExternalDeliveryPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL)) {
    return <p className="text-gray-500">You don&apos;t have permission to record external deliveries.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [products, branches] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, tracksBatches: true },
    }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Record an external delivery</h1>
        <p className="mt-1 text-sm text-gray-500">
          Stock delivered directly to a branch from a supplier, bypassing a warehouse.
        </p>
      </div>
      <ReceiveExternalForm products={products} branches={branches} />
    </div>
  );
}
