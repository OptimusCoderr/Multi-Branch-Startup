import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { LocationForm } from "@/components/forms/location-form";
import { updateWarehouse, deactivateWarehouse } from "@/server/actions/warehouses";

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const warehouse = await db.warehouse.findUnique({ where: { id } });
  if (!warehouse) notFound();

  if (!permissions.has(PERMISSIONS.WAREHOUSES_MANAGE)) {
    return <p className="text-gray-500">You don&apos;t have permission to edit warehouses.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit warehouse</h1>
        <form action={deactivateWarehouse.bind(null, warehouse.id)}>
          <button type="submit" className="text-sm text-red-600 hover:underline">
            {warehouse.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </div>
      <LocationForm
        action={updateWarehouse.bind(null, warehouse.id)}
        defaultValues={{ name: warehouse.name, address: warehouse.address }}
        submitLabel="Save changes"
      />
    </div>
  );
}
