import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CreateSaleForm } from "@/components/forms/create-sale-form";

export default async function NewSalePage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SALES_RECORD)) {
    return <p className="text-gray-500">You don&apos;t have permission to record sales.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [branches, products] = await Promise.all([
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unitPrice: true },
    }),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Record a sale</h1>
      <CreateSaleForm
        branches={branches}
        products={products.map((p) => ({ ...p, unitPrice: p.unitPrice.toString() }))}
        currency={membership.companyCurrency}
      />
    </div>
  );
}
