import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { deactivateBranch } from "@/server/actions/branches";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import {
  PageHeader,
  LinkButton,
  Button,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
} from "@/components/ui";
import { Building2 } from "lucide-react";

export default async function BranchesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const [branches, { maxBranches }] = await Promise.all([
    db.branch.findMany({ orderBy: { name: "asc" } }),
    getPlanFeaturesForCompany(membership.companyId),
  ]);

  const canManage = permissions.has(PERMISSIONS.BRANCHES_MANAGE);
  const activeCount = branches.filter((b) => b.isActive).length;
  const atLimit = maxBranches !== undefined && activeCount >= maxBranches;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Branches"
        description={maxBranches !== undefined ? `${activeCount} of ${maxBranches} used on your plan${atLimit ? " — upgrade for more" : ""}` : undefined}
        actions={canManage && <LinkButton href="/branches/new">New branch</LinkButton>}
      />
      {atLimit && (
        <Link href="/settings/billing" className="-mt-4 text-sm font-medium text-amber-700 dark:text-amber-400 underline">
          Upgrade for more branches
        </Link>
      )}

      {branches.length === 0 ? (
        <EmptyState icon={Building2} title="No branches yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Address</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{b.address ?? "—"}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{b.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-3">
                    {canManage && (
                      <>
                        <LinkButton href={`/branches/${b.id}`} variant="link">
                          Edit
                        </LinkButton>
                        <form action={deactivateBranch.bind(null, b.id)}>
                          <Button type="submit" variant="danger-link">
                            {b.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
