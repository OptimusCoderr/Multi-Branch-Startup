import Link from "next/link";
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

  // This flow moves stock OUT of a warehouse — with none, the form would
  // just be a source picker with nothing in it. Point at the path that
  // actually works for a business with no warehouse instead of rendering
  // a technically-present-but-unusable form.
  if (warehouses.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold">Request a stock transfer</h1>
        <p className="text-gray-500">
          This moves stock out of one of your warehouses — you don&apos;t have any yet. If you&apos;re
          receiving stock from a supplier, use{" "}
          <Link href="/transfers/new-external" className="text-[var(--brand-primary)] hover:underline">
            Record external delivery
          </Link>{" "}
          to stock a branch directly instead, or{" "}
          <Link href="/warehouses/new" className="text-[var(--brand-primary)] hover:underline">
            create a warehouse
          </Link>{" "}
          first if you want one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">Request a stock transfer</h1>
      <RequestTransferForm products={products} warehouses={warehouses} branches={branches} />
    </div>
  );
}
