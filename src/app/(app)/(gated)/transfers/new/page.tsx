import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { RequestTransferForm } from "@/components/forms/request-transfer-form";

export default async function NewTransferPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.TRANSFERS_REQUEST)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to request stock transfers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [products, branches] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Request a stock transfer</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A reviewer will pick where the stock comes from (a warehouse, another branch, or an external supplier) when they approve
          this request.
        </p>
      </div>
      <RequestTransferForm products={products} branches={branches} />
    </div>
  );
}
