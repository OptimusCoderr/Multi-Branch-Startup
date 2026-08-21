import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ChangeRoleForm } from "@/components/forms/change-role-form";
import { setPermissionOverride, suspendStaff, reactivateStaff, removeStaff } from "@/server/actions/staff";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const staffMember = await db.membership.findUnique({
    where: { id },
    include: {
      user: true,
      role: { include: { rolePermissions: { include: { permission: true } } } },
      permissionOverrides: { include: { permission: true } },
    },
  });
  if (!staffMember) notFound();

  const canManageRoles = permissions.has(PERMISSIONS.STAFF_MANAGE_ROLES);
  const canManagePermissions = permissions.has(PERMISSIONS.STAFF_MANAGE_PERMISSIONS);
  const canRemove = permissions.has(PERMISSIONS.STAFF_REMOVE);
  const isSelf = staffMember.id === membership.membershipId;

  const roles = canManageRoles ? await db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];

  // Permission is a global, non-tenant-scoped catalog (see prisma/seed.ts) —
  // queried through the raw client, not getScopedPrisma.
  const permissionCatalog = canManagePermissions
    ? await prisma.permission.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] })
    : [];

  const roleGrantedIds = new Set((staffMember.role?.rolePermissions ?? []).map((rp) => rp.permissionId));
  const overrideByPermissionId = new Map(staffMember.permissionOverrides.map((o) => [o.permissionId, o.effect]));

  const categories = [...new Set(permissionCatalog.map((p) => p.category))];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{staffMember.displayName ?? staffMember.user.name}</h1>
        <p className="text-sm text-gray-500">
          {staffMember.user.email} · {staffMember.status}
        </p>
      </div>

      {canManageRoles && !isSelf && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Role</p>
          <ChangeRoleForm membershipId={staffMember.id} roles={roles} currentRoleId={staffMember.roleId} />
        </div>
      )}
      {canManageRoles && isSelf && (
        <p className="text-sm text-gray-500">
          You can&apos;t change your own role — ask another staff member with role-management access.
        </p>
      )}

      {canRemove && !isSelf && (
        <div className="flex gap-3">
          {staffMember.status === "ACTIVE" ? (
            <form action={suspendStaff.bind(null, staffMember.id)}>
              <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                Suspend
              </button>
            </form>
          ) : staffMember.status === "SUSPENDED" ? (
            <form action={reactivateStaff.bind(null, staffMember.id)}>
              <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
                Reactivate
              </button>
            </form>
          ) : null}
          <form action={removeStaff.bind(null, staffMember.id)}>
            <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Remove from company
            </button>
          </form>
        </div>
      )}

      {canManagePermissions && isSelf && (
        <p className="text-sm text-gray-500">
          You can&apos;t change your own permission overrides — ask another staff member with permission-management
          access.
        </p>
      )}

      {canManagePermissions && !isSelf && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Permission overrides</p>
          <p className="mb-3 text-sm text-gray-500">
            Grant or deny individual permissions on top of {staffMember.role?.name ?? "their role"}. Deny always wins.
          </p>
          {categories.map((category) => (
            <div key={category} className="mb-4">
              <p className="mb-1 text-sm font-medium capitalize">{category}</p>
              <div className="flex flex-col gap-1">
                {permissionCatalog
                  .filter((p) => p.category === category)
                  .map((permission) => {
                    const fromRole = roleGrantedIds.has(permission.id);
                    const override = overrideByPermissionId.get(permission.id);
                    const effective = override === "DENY" ? false : override === "GRANT" ? true : fromRole;

                    return (
                      <div
                        key={permission.id}
                        data-testid={`permission-row-${permission.key}`}
                        className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-gray-50"
                      >
                        <div>
                          <span className={effective ? "text-gray-900" : "text-gray-400"}>{permission.description}</span>
                          {override && (
                            <span className="ml-2 text-xs text-gray-400">
                              ({override === "GRANT" ? "granted" : "denied"} — overrides role)
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <form action={setPermissionOverride.bind(null, staffMember.id, permission.id, "GRANT")}>
                            <button
                              type="submit"
                              disabled={override === "GRANT"}
                              className="rounded px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-30"
                            >
                              Grant
                            </button>
                          </form>
                          <form action={setPermissionOverride.bind(null, staffMember.id, permission.id, "DENY")}>
                            <button
                              type="submit"
                              disabled={override === "DENY"}
                              className="rounded px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-30"
                            >
                              Deny
                            </button>
                          </form>
                          <form action={setPermissionOverride.bind(null, staffMember.id, permission.id, "INHERIT")}>
                            <button
                              type="submit"
                              disabled={!override}
                              className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            >
                              Reset
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
