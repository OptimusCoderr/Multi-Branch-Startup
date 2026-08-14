import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { deactivateBranch } from "@/server/actions/branches";

export default async function BranchesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const branches = await db.branch.findMany({ orderBy: { name: "asc" } });

  const canManage = permissions.has(PERMISSIONS.BRANCHES_MANAGE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Branches</h1>
        {canManage && (
          <Link href="/branches/new" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
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
                          <Link href={`/branches/${b.id}`} className="text-blue-600 hover:underline">
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
