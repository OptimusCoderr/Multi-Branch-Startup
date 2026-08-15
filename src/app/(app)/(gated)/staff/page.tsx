import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InviteStaffForm } from "@/components/forms/invite-staff-form";
import { revokeInvitation } from "@/server/actions/staff";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INVITED: "bg-yellow-100 text-yellow-700",
  SUSPENDED: "bg-gray-100 text-gray-500",
  REMOVED: "bg-gray-100 text-gray-400",
};

export default async function StaffPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const canInvite = permissions.has(PERMISSIONS.STAFF_INVITE);
  const canManage =
    canInvite ||
    permissions.has(PERMISSIONS.STAFF_MANAGE_ROLES) ||
    permissions.has(PERMISSIONS.STAFF_MANAGE_PERMISSIONS) ||
    permissions.has(PERMISSIONS.STAFF_REMOVE);

  if (!canManage) {
    return <p className="text-gray-500">You don&apos;t have permission to view staff management.</p>;
  }

  const [members, invitations, roles] = await Promise.all([
    db.membership.findMany({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
      include: { user: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    canInvite
      ? db.invitation.findMany({ where: { status: "PENDING" }, include: { role: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Staff</h1>

      {canInvite && <InviteStaffForm roles={roles} />}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">
                  {m.displayName ?? m.user.name} {m.id === membership.membershipId && <span className="text-xs text-gray-400">(you)</span>}
                </td>
                <td className="py-2 pr-4 text-gray-500">{m.user.email}</td>
                <td className="py-2 pr-4">{m.role?.name ?? "—"}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[m.status] ?? ""}`}>{m.status}</span>
                </td>
                <td className="py-2 text-right">
                  <Link href={`/staff/${m.id}`} className="text-[var(--brand-primary)] hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canInvite && invitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-gray-400">Pending invitations</p>
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
              <span>
                {inv.email} · {inv.role.name} · expires {inv.expiresAt.toLocaleDateString()}
              </span>
              <form action={revokeInvitation.bind(null, inv.id)}>
                <button type="submit" className="text-red-600 hover:underline">
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
