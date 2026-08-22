import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SupplierForm } from "@/components/forms/supplier-form";
import { createSupplier } from "@/server/actions/suppliers";

export default async function NewSupplierPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PURCHASE_ORDERS_MANAGE)) {
    return <p className="text-gray-500">You don&apos;t have permission to create suppliers.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New supplier</h1>
      <SupplierForm action={createSupplier} submitLabel="Create supplier" />
    </div>
  );
}
