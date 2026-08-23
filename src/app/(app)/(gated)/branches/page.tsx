import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import { PageHeader } from "@/components/ui";
import { BranchesPageClient } from "@/components/branches/branches-page-client";

export default async function BranchesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const [branches, { maxBranches }] = await Promise.all([
    db.branch.findMany({ orderBy: { name: "asc" } }),
    getPlanFeaturesForCompany(membership.companyId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Branches" />
      <BranchesPageClient branches={branches} maxBranches={maxBranches} canManage={permissions.has(PERMISSIONS.BRANCHES_MANAGE)} />
    </div>
  );
}
