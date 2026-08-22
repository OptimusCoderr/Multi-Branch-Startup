import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { LocationForm } from "@/components/forms/location-form";
import { createWarehouse } from "@/server/actions/warehouses";

export default async function NewWarehousePage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.WAREHOUSES_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to create warehouses.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New warehouse</h1>
      <LocationForm action={createWarehouse} submitLabel="Create warehouse" />
    </div>
  );
}
