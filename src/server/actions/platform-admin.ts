"use server";

import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/better-auth";
import { requirePlatformStaffOrThrow, requireSuperAdminOrThrow, AuthorizationError } from "@/lib/auth/session";
import { captureResetPasswordUrl } from "@/lib/auth/reset-password-capture";
import { writePlatformAuditLog } from "@/server/services/platform-audit-service";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function generateStrongPassword(): string {
  return randomBytes(24).toString("base64url");
}

const emailSchema = z.email();

type LinkState = { error: string; link?: string };

/**
 * A support agent (or super admin)'s core "help someone who's locked out"
 * tool. No email provider is configured (same situation staff invites
 * already handle), so instead of Better Auth actually emailing the reset
 * link, sendResetPassword (better-auth.ts) captures it and this action
 * hands it straight back to be shared with the user directly.
 */
export async function generatePasswordResetLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const staff = await requirePlatformStaffOrThrow();

  try {
    checkRateLimit(`platform.password_reset:${staff.userId}`, { max: 20, windowMs: 60 * 1000 });
  } catch (err) {
    return { error: err instanceof RateLimitError ? err.message : "Too many requests." };
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }
  const email = parsed.data;

  const link = await captureResetPasswordUrl(async () => {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
  });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: staff.userId,
    action: "platform.password_reset_link_generated",
    targetEmail: email,
    metadata: { found: link !== null },
    ipAddress,
    userAgent,
  });

  if (!link) {
    return { error: "No account found for that email." };
  }
  return { error: "", link };
}

type PromoteState = { error: string; password?: string; email?: string };

const promoteSchema = z.object({
  email: z.email(),
  role: z.enum(["SUPER_ADMIN", "SUPPORT_AGENT"]),
});

/**
 * Grants (or changes) a platform role. SUPER_ADMIN only — a support agent
 * can help customers but can't grant platform access to anyone else,
 * including themselves. If the email doesn't have an account yet, one is
 * created through Better Auth's own signUpEmail() (so password hashing is
 * never reimplemented by hand — same approach as
 * scripts/create-platform-admin.ts) with a freshly generated password,
 * returned once and never stored.
 */
export async function promotePlatformStaff(_prev: PromoteState, formData: FormData): Promise<PromoteState> {
  const admin = await requireSuperAdminOrThrow();

  const parsed = promoteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, role } = parsed.data;

  let existing = await prisma.user.findUnique({ where: { email } });
  let generatedPassword: string | undefined;

  if (!existing) {
    generatedPassword = generateStrongPassword();
    const result = await auth.api.signUpEmail({ body: { email, name: email.split("@")[0], password: generatedPassword } });
    existing = await prisma.user.findUnique({ where: { id: result.user.id } });
  }
  if (!existing) {
    return { error: "Could not create the account." };
  }

  await prisma.user.update({ where: { id: existing.id }, data: { platformRole: role } });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.staff_promoted",
    targetEmail: email,
    metadata: { role, newAccount: Boolean(generatedPassword) },
    ipAddress,
    userAgent,
  });

  return { error: "", password: generatedPassword, email };
}

/** SUPER_ADMIN only — revokes a platform role entirely. Can't demote yourself, mirroring the "can't remove the last Owner" guard staff-service.ts uses for companies. */
export async function demotePlatformStaff(userId: string): Promise<{ error: string } | void> {
  const admin = await requireSuperAdminOrThrow();

  if (userId === admin.userId) {
    return { error: "You can't remove your own platform access." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AuthorizationError("User not found.");

  await prisma.user.update({ where: { id: userId }, data: { platformRole: null } });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.staff_demoted",
    targetEmail: target.email,
    ipAddress,
    userAgent,
  });
}
