import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SupplierForm } from "@/components/forms/supplier-form";
import { updateSupplier, archiveSupplier } from "@/server/actions/suppliers";
import { Button } from "@/components/ui";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  if (!permissions.has(PERMISSIONS.PURCHASE_ORDERS_MANAGE)) {
    return <p className="text-gray-500">You don&apos;t have permission to edit suppliers.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit supplier</h1>
        <form action={archiveSupplier.bind(null, supplier.id)}>
          <Button type="submit" variant="danger-link">
            {supplier.isActive ? "Archive" : "Reactivate"}
          </Button>
        </form>
      </div>
      <SupplierForm
        action={updateSupplier.bind(null, supplier.id)}
        defaultValues={{
          name: supplier.name,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          notes: supplier.notes,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
