import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { deactivateWarehouse } from "@/server/actions/warehouses";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";

export default async function WarehousesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const [warehouses, { maxWarehouses }] = await Promise.all([
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    getPlanFeaturesForCompany(membership.companyId),
  ]);

  const canManage = permissions.has(PERMISSIONS.WAREHOUSES_MANAGE);
  const activeCount = warehouses.filter((w) => w.isActive).length;
  const atLimit = maxWarehouses !== undefined && activeCount >= maxWarehouses;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Warehouses</h1>
          {maxWarehouses !== undefined && (
            <p className={`mt-1 text-sm ${atLimit ? "font-medium text-amber-700" : "text-gray-500"}`}>
              {activeCount} of {maxWarehouses} used on your plan
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
          <Link href="/warehouses/new" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
            New warehouse
          </Link>
        )}
      </div>

      {warehouses.length === 0 ? (
        <p className="text-gray-500">No warehouses yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{w.name}</td>
                  <td className="py-2 pr-4 text-gray-500">{w.address ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        w.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {w.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      {canManage && (
                        <>
                          <Link href={`/warehouses/${w.id}`} className="text-[var(--brand-primary)] hover:underline">
                            Edit
                          </Link>
                          <form action={deactivateWarehouse.bind(null, w.id)}>
                            <button type="submit" className="text-red-600 hover:underline">
                              {w.isActive ? "Deactivate" : "Reactivate"}
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
