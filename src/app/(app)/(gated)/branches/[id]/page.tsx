import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { LocationForm } from "@/components/forms/location-form";
import { updateBranch, deactivateBranch } from "@/server/actions/branches";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const branch = await db.branch.findUnique({ where: { id } });
  if (!branch) notFound();

  if (!permissions.has(PERMISSIONS.BRANCHES_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to edit branches.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit branch</h1>
        <form action={deactivateBranch.bind(null, branch.id)}>
          <button type="submit" className="text-sm text-red-600 dark:text-red-400 hover:underline">
            {branch.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </div>
      <LocationForm
        action={updateBranch.bind(null, branch.id)}
        defaultValues={{ name: branch.name, address: branch.address, phone: branch.phone }}
        submitLabel="Save changes"
        showPhone
      />
    </div>
  );
}
