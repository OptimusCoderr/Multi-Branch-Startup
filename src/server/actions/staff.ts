"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { prisma } from "@/lib/db/prisma";
import { requireMembershipOrThrow, requirePermission, getSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { inviteStaffSchema, updateStaffRoleSchema } from "@/lib/validation/staff.schema";
import * as staffService from "@/server/services/staff-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertUnderStaffLimit, PlanLimitError } from "@/server/services/plan-limit-service";

type ErrorResult = { error: string };
type InviteResult = { error: string; inviteUrl?: string };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof staffService.StaffActionError || err instanceof RateLimitError || err instanceof PlanLimitError) {
    return err.message;
  }
  return fallback;
}

export async function inviteStaff(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.STAFF_INVITE);

  try {
    // Invitations send an email in a fully configured deployment — capping
    // this stops a compromised or careless Owner/Admin account from being
    // used to spam-invite (or enumerate) email addresses.
    checkRateLimit(`staff.invite:${membership.membershipId}`, { max: 20, windowMs: 60 * 60 * 1000 });
  } catch (err) {
    return { error: friendlyError(err, "Too many invitations sent recently.") };
  }

  const parsed = inviteStaffSchema.safeParse({ email: formData.get("email"), roleId: formData.get("roleId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invite details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  let token = "";

  try {
    await db.$transaction(
      async (tx) => {
        // Re-checked here under SERIALIZABLE isolation — a plain
        // check-then-act read before the transaction let two concurrent
        // invites each pass the seat-count check and jointly land the
        // company over its plan's staff cap (same fix as
        // branches.ts/warehouses.ts).
        await assertUnderStaffLimit(tx, membership.companyId);

        const result = await staffService.inviteStaff(tx, membership.companyId, membership.membershipId, parsed.data);
        token = result.token;

        await writeAuditLog(tx, {
          companyId: membership.companyId,
          actorMembershipId: membership.membershipId,
          action: "staff.invited",
          entityType: "Invitation",
          entityId: result.invitationId,
          metadata: { email: parsed.data.email, roleId: parsed.data.roleId },
          ipAddress,
          userAgent,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    return { error: friendlyError(err, "Could not create the invitation.") };
  }

  revalidatePath("/staff");
  const baseUrl = process.env.BETTER_AUTH_URL ?? "";
  return { error: "", inviteUrl: `${baseUrl}/invite/${token}` };
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.STAFF_INVITE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const invitation = await staffService.revokeInvitation(tx, invitationId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "staff.invitation_revoked",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/staff");
}

export async function updateStaffRole(
  membershipId: string,
  _prev: ErrorResult,
  formData: FormData,
): Promise<ErrorResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.STAFF_MANAGE_ROLES);

  const parsed = updateStaffRoleSchema.safeParse({ roleId: formData.get("roleId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid role." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const updated = await staffService.updateStaffRole(tx, membership.membershipId, membershipId, parsed.data.roleId);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "staff.role_changed",
        entityType: "Membership",
        entityId: updated.id,
        metadata: { roleId: parsed.data.roleId },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not change the staff member's role.") };
  }

  revalidatePath(`/staff/${membershipId}`);
  redirect(`/staff/${membershipId}`);
}

export async function setPermissionOverride(
  membershipId: string,
  permissionId: string,
  effect: "GRANT" | "DENY" | "INHERIT",
): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.STAFF_MANAGE_PERMISSIONS);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    await staffService.setPermissionOverride(tx, membership.membershipId, membershipId, permissionId, effect);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "staff.permission_changed",
      entityType: "Membership",
      entityId: membershipId,
      metadata: { permissionId, effect },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath(`/staff/${membershipId}`);
}

async function changeStaffStatus(membershipId: string, status: "SUSPENDED" | "ACTIVE" | "REMOVED", action: string) {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.STAFF_REMOVE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const updated = await staffService.setStaffStatus(tx, membership.membershipId, membershipId, status);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action,
      entityType: "Membership",
      entityId: updated.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath(`/staff/${membershipId}`);
  revalidatePath("/staff");
}

export async function suspendStaff(membershipId: string): Promise<void> {
  await changeStaffStatus(membershipId, "SUSPENDED", "staff.suspended");
}

export async function reactivateStaff(membershipId: string): Promise<void> {
  await changeStaffStatus(membershipId, "ACTIVE", "staff.reactivated");
}

export async function removeStaff(membershipId: string): Promise<void> {
  await changeStaffStatus(membershipId, "REMOVED", "staff.removed");
}

/**
 * Accepts an invitation for the currently signed-in user. Unlike every
 * other action in this file, this one deliberately does NOT call
 * requireMembershipOrThrow() — the whole point is that the caller doesn't
 * have a Membership yet.
 */
export async function acceptInvitation(token: string): Promise<{ error: string }> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to accept this invitation." };
  }

  const { ipAddress, userAgent } = await requestMeta();

  try {
    await prisma.$transaction(async (tx) => {
      const { companyId, membershipId } = await staffService.acceptInvitation(tx, token, session.user);
      await writeAuditLog(tx, {
        companyId,
        actorMembershipId: membershipId,
        action: "staff.joined",
        entityType: "Membership",
        entityId: membershipId,
        metadata: {},
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not accept the invitation.") };
  }

  redirect("/dashboard");
}
