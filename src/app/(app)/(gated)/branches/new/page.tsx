import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { LocationForm } from "@/components/forms/location-form";
import { createBranch } from "@/server/actions/branches";

export default async function NewBranchPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.BRANCHES_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to create branches.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New branch</h1>
      <LocationForm action={createBranch} submitLabel="Create branch" showPhone />
    </div>
  );
}
