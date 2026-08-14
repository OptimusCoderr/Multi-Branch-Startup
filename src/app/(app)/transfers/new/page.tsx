import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { RequestTransferForm } from "@/components/forms/request-transfer-form";

export default async function NewTransferPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.TRANSFERS_REQUEST)) {
    return <p className="text-gray-500">You don&apos;t have permission to request stock transfers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [products, warehouses, branches] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">Request a stock transfer</h1>
      <RequestTransferForm products={products} warehouses={warehouses} branches={branches} />
    </div>
  );
}
