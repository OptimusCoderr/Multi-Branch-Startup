import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { deactivateBranch } from "@/server/actions/branches";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branches</h1>
          {maxBranches !== undefined && (
            <p className={`mt-1 text-sm ${atLimit ? "font-medium text-amber-700" : "text-gray-500"}`}>
              {activeCount} of {maxBranches} used on your plan
              {atLimit && (
                <>
                  {" — "}
                  <Link href="/settings/billing" className="underline">
                    upgrade for more
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        {canManage && (
          <Link href="/branches/new" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
            New branch
          </Link>
        )}
      </div>

      {branches.length === 0 ? (
        <p className="text-gray-500">No branches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{b.name}</td>
                  <td className="py-2 pr-4 text-gray-500">{b.address ?? "—"}</td>
                  <td className="py-2 pr-4 text-gray-500">{b.phone ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      {canManage && (
                        <>
                          <Link href={`/branches/${b.id}`} className="text-[var(--brand-primary)] hover:underline">
                            Edit
                          </Link>
                          <form action={deactivateBranch.bind(null, b.id)}>
                            <button type="submit" className="text-red-600 hover:underline">
                              {b.isActive ? "Deactivate" : "Reactivate"}
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
