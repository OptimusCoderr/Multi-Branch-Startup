import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InviteStaffForm } from "@/components/forms/invite-staff-form";
import { revokeInvitation } from "@/server/actions/staff";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import { PageHeader, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Badge, Button, LinkButton, type BadgeVariant } from "@/components/ui";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  INVITED: "warning",
  SUSPENDED: "neutral",
  REMOVED: "neutral",
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
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view staff management.</p>;
  }

  const [members, invitations, roles, { maxStaff }] = await Promise.all([
    db.membership.findMany({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
      include: { user: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    canInvite
      ? db.invitation.findMany({ where: { status: "PENDING" }, include: { role: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getPlanFeaturesForCompany(membership.companyId),
  ]);

  const seatsUsed = members.filter((m) => m.status === "ACTIVE").length + invitations.length;
  const atLimit = maxStaff !== undefined && seatsUsed >= maxStaff;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description={
          maxStaff !== undefined
            ? `${seatsUsed} of ${maxStaff} seats used on your plan${atLimit ? " — upgrade for more" : ""}`
            : undefined
        }
      />
      {atLimit && (
        <Link href="/settings/billing" className="-mt-4 text-sm font-medium text-amber-700 dark:text-amber-400 underline">
          Upgrade for more seats
        </Link>
      )}

      {canInvite && <InviteStaffForm roles={roles} />}

      <Table>
        <TableHeader>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Email</TableHeaderCell>
          <TableHeaderCell>Role</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell align="right"></TableHeaderCell>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                {m.displayName ?? m.user.name} {m.id === membership.membershipId && <span className="text-xs text-gray-400 dark:text-gray-500">(you)</span>}
              </TableCell>
              <TableCell className="text-gray-500 dark:text-gray-400">{m.user.email}</TableCell>
              <TableCell>{m.role?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[m.status] ?? "neutral"}>{m.status}</Badge>
              </TableCell>
              <TableCell align="right">
                <LinkButton variant="link" href={`/staff/${m.id}`}>
                  Manage
                </LinkButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canInvite && invitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Pending invitations</p>
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm">
              <span>
                {inv.email} · {inv.role.name} · expires {inv.expiresAt.toLocaleDateString()}
              </span>
              <form action={revokeInvitation.bind(null, inv.id)}>
                <Button type="submit" variant="danger-link">
                  Revoke
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
