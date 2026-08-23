import "server-only";
import type { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { prisma } from "@/lib/db/prisma";
import { generateInvitationToken, hashInvitationToken } from "@/lib/auth/invitation-token";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  "invitation" | "membership" | "role" | "membershipPermissionOverride"
>;

export class StaffActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffActionError";
  }
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function countActiveOwners(tx: ScopedTx, companyId: string): Promise<number> {
  return tx.membership.count({
    where: { companyId, status: "ACTIVE", role: { name: "Owner", isSystem: true } },
  });
}

/**
 * Creates (or replaces a still-pending) invitation. Returns the raw token
 * once, here — only its hash is ever persisted, so this is the only place
 * in the codebase that ever sees the real invite link.
 */
export async function inviteStaff(
  tx: ScopedTx,
  companyId: string,
  invitedByMembershipId: string,
  input: { email: string; roleId: string },
): Promise<{ invitationId: string; token: string }> {
  const role = await tx.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new StaffActionError("Role not found.");

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const existingMembership = await tx.membership.findFirst({
      where: { userId: existingUser.id, status: { in: ["ACTIVE", "INVITED"] } },
    });
    if (existingMembership) {
      throw new StaffActionError("This email is already linked to a company.");
    }
  }

  const existingInvite = await tx.invitation.findFirst({ where: { email: input.email, status: "PENDING" } });
  if (existingInvite) {
    await tx.invitation.update({ where: { id: existingInvite.id }, data: { status: "REVOKED" } });
  }

  const { token, tokenHash } = generateInvitationToken();
  const invitation = await tx.invitation.create({
    data: {
      companyId,
      email: input.email,
      roleId: input.roleId,
      invitedByMembershipId,
      tokenHash,
      status: "PENDING",
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  return { invitationId: invitation.id, token };
}

export async function revokeInvitation(tx: ScopedTx, invitationId: string) {
  const invitation = await tx.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) throw new StaffActionError("Invitation not found.");
  if (invitation.status !== "PENDING") throw new StaffActionError("Only pending invitations can be revoked.");
  return tx.invitation.update({ where: { id: invitationId }, data: { status: "REVOKED" } });
}

/**
 * Accepts an invitation for the given (already-authenticated) user. The
 * raw token from the URL is hashed and matched against the stored hash —
 * never compared or stored in plaintext.
 */
export async function acceptInvitation(
  tx: Prisma.TransactionClient,
  token: string,
  user: { id: string; email: string },
): Promise<{ companyId: string; membershipId: string }> {
  const tokenHash = hashInvitationToken(token);
  const invitation = await tx.invitation.findUnique({ where: { tokenHash } });

  if (!invitation) throw new StaffActionError("This invitation link is invalid.");
  if (invitation.status !== "PENDING") throw new StaffActionError("This invitation has already been used or revoked.");
  if (invitation.expiresAt < new Date()) throw new StaffActionError("This invitation has expired.");
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new StaffActionError("This invitation was sent to a different email address.");
  }

  const existingMembership = await tx.membership.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "INVITED"] } },
  });
  if (existingMembership) {
    throw new StaffActionError("This account is already linked to a company.");
  }

  const membership = await tx.membership.create({
    data: {
      companyId: invitation.companyId,
      userId: user.id,
      roleId: invitation.roleId,
      status: "ACTIVE",
      invitedByMembershipId: invitation.invitedByMembershipId,
      invitedAt: invitation.createdAt,
      joinedAt: new Date(),
    },
  });

  await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });

  return { companyId: invitation.companyId, membershipId: membership.id };
}

export async function updateStaffRole(tx: ScopedTx, actorMembershipId: string, membershipId: string, roleId: string) {
  // Without this, anyone holding STAFF_MANAGE_ROLES could grant *themselves*
  // Owner (or any other role) with no check that they already held
  // equivalent privilege — a straight self-service escalation, unlike
  // changing someone else's role, which is the normal, intended use of
  // this permission. Same self-targeting boundary setStaffStatus() already
  // enforces for suspend/remove.
  if (membershipId === actorMembershipId) {
    throw new StaffActionError("You cannot change your own role — ask another staff member with role-management access.");
  }

  const membership = await tx.membership.findUnique({ where: { id: membershipId }, include: { role: true } });
  if (!membership) throw new StaffActionError("Staff member not found.");

  const newRole = await tx.role.findUnique({ where: { id: roleId } });
  if (!newRole) throw new StaffActionError("Role not found.");

  if (membership.role?.name === "Owner" && newRole.name !== "Owner") {
    const ownerCount = await countActiveOwners(tx, membership.companyId);
    if (ownerCount <= 1) {
      throw new StaffActionError("A company must have at least one Owner — assign another Owner first.");
    }
  }

  return tx.membership.update({ where: { id: membershipId }, data: { roleId } });
}

export async function setPermissionOverride(
  tx: ScopedTx,
  grantedByMembershipId: string,
  membershipId: string,
  permissionId: string,
  effect: "GRANT" | "DENY" | "INHERIT",
) {
  // Same self-targeting boundary as updateStaffRole() — otherwise anyone
  // holding STAFF_MANAGE_PERMISSIONS could GRANT themselves any individual
  // permission they lack (e.g. billing.manage) with nobody else's sign-off.
  if (membershipId === grantedByMembershipId) {
    throw new StaffActionError("You cannot change your own permission overrides — ask another staff member with permission-management access.");
  }

  const membership = await tx.membership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new StaffActionError("Staff member not found.");

  if (effect === "INHERIT") {
    await tx.membershipPermissionOverride.deleteMany({ where: { membershipId, permissionId } });
    return;
  }

  await tx.membershipPermissionOverride.upsert({
    where: { membershipId_permissionId: { membershipId, permissionId } },
    create: { membershipId, permissionId, effect, grantedByMembershipId },
    update: { effect, grantedByMembershipId },
  });
}

/**
 * Suspending (or removing) a staff member also deletes their Better Auth
 * sessions, so access is cut immediately rather than merely blocked on
 * their next request — true "force logout," not just an app-layer check
 * (which also independently blocks a SUSPENDED membership on every
 * request regardless, as defense-in-depth).
 */
async function killSessionsForMembership(tx: ScopedTx, membershipId: string) {
  const membership = await tx.membership.findUnique({ where: { id: membershipId } });
  if (!membership) return;
  await prisma.session.deleteMany({ where: { userId: membership.userId } });
}

/**
 * Approves a self-service join request (see staff-signup.ts): assigns the
 * chosen role and flips the Membership from PENDING to ACTIVE. Gated on
 * STAFF_INVITE, not STAFF_MANAGE_ROLES — approving a join request is the
 * staff-initiated mirror of sending an invite (both are "let this person
 * into the company"), not an ordinary role change on an existing member.
 */
export async function approvePendingStaff(tx: ScopedTx, membershipId: string, roleId: string) {
  const membership = await tx.membership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new StaffActionError("Request not found.");
  if (membership.status !== "PENDING") throw new StaffActionError("This request has already been resolved.");

  const role = await tx.role.findUnique({ where: { id: roleId } });
  if (!role) throw new StaffActionError("Role not found.");

  return tx.membership.update({
    where: { id: membershipId },
    data: { roleId, status: "ACTIVE", joinedAt: new Date() },
  });
}

/**
 * Rejects a self-service join request. Kept as REMOVED rather than
 * hard-deleted — same "never lose the trail" approach as every other
 * status change in this file — so there's a record the request existed
 * and was declined.
 */
export async function rejectPendingStaff(tx: ScopedTx, membershipId: string) {
  const membership = await tx.membership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new StaffActionError("Request not found.");
  if (membership.status !== "PENDING") throw new StaffActionError("This request has already been resolved.");

  return tx.membership.update({ where: { id: membershipId }, data: { status: "REMOVED" } });
}

export async function setStaffStatus(
  tx: ScopedTx,
  actorMembershipId: string,
  membershipId: string,
  status: "SUSPENDED" | "ACTIVE" | "REMOVED",
) {
  if (membershipId === actorMembershipId && status !== "ACTIVE") {
    throw new StaffActionError("You cannot suspend or remove your own account.");
  }

  const membership = await tx.membership.findUnique({ where: { id: membershipId }, include: { role: true } });
  if (!membership) throw new StaffActionError("Staff member not found.");

  if (membership.role?.name === "Owner" && status !== "ACTIVE") {
    const ownerCount = await countActiveOwners(tx, membership.companyId);
    if (ownerCount <= 1) {
      throw new StaffActionError("A company must have at least one active Owner.");
    }
  }

  const updated = await tx.membership.update({ where: { id: membershipId }, data: { status } });

  if (status !== "ACTIVE") {
    await killSessionsForMembership(tx, membershipId);
  }

  return updated;
}
