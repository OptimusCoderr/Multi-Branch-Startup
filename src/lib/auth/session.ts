import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/better-auth";
import { prisma } from "@/lib/db/prisma";
import type { PermissionKey } from "@/lib/auth/permissions";

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type AuthenticatedMembership = {
  membershipId: string;
  userId: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  companyStatus: string;
  roleId: string | null;
  roleName: string | null;
};

/**
 * Resolves the current Better Auth session. Returns null if there isn't
 * one — callers decide whether that's a redirect (page) or a thrown error
 * (Server Action / Route Handler).
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Resolves the current session's *active* Membership (staff record) for
 * their company, re-read from the database on every call — permissions and
 * membership status are never trusted from a cached session claim. Returns
 * null if there's no session or no active Membership (e.g. a signed-up user
 * who hasn't completed company onboarding yet, or a suspended staff member).
 */
export async function getCurrentMembership(): Promise<AuthenticatedMembership | null> {
  const session = await getSession();
  if (!session) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { company: true, role: true },
  });

  if (!membership) return null;
  if (membership.company.status === "SUSPENDED") return null;

  return {
    membershipId: membership.id,
    userId: membership.userId,
    companyId: membership.companyId,
    companySlug: membership.company.slug,
    companyName: membership.company.name,
    companyStatus: membership.company.status,
    roleId: membership.roleId,
    roleName: membership.role?.name ?? null,
  };
}

/** For Server Components/pages: redirects to /sign-in if unauthenticated. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/**
 * For Server Components/pages: redirects to /sign-in if there's no session
 * at all, or to /onboarding if the user is signed in but hasn't finished
 * creating/joining a company yet.
 */
export async function requireMembership(): Promise<AuthenticatedMembership> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  return membership;
}

/**
 * For Server Actions / Route Handlers: throws instead of redirecting, since
 * these run outside of render and a redirect() there is the wrong tool.
 */
export async function requireMembershipOrThrow(): Promise<AuthenticatedMembership> {
  const membership = await getCurrentMembership();
  if (!membership) throw new AuthorizationError("Not signed in to an active company.");
  return membership;
}

/**
 * Computes the effective permission set for a membership:
 * (role's permissions) ∪ (GRANT overrides) − (DENY overrides), with DENY
 * always winning. Always recomputed from the database — never cached
 * across requests — so revoking a permission takes effect immediately.
 */
export async function computeEffectivePermissions(membershipId: string): Promise<Set<PermissionKey>> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      permissionOverrides: { include: { permission: true } },
    },
  });

  if (!membership) return new Set();

  const effective = new Set<PermissionKey>(
    (membership.role?.rolePermissions ?? []).map((rp) => rp.permission.key as PermissionKey),
  );

  for (const override of membership.permissionOverrides) {
    const key = override.permission.key as PermissionKey;
    if (override.effect === "GRANT") effective.add(key);
    else effective.delete(key);
  }

  return effective;
}

/**
 * The core server-side authorization gate. Call this at the top of every
 * privileged Server Action / Route Handler — never rely on the UI hiding a
 * button as the only enforcement.
 */
export async function requirePermission(membershipId: string, permission: PermissionKey): Promise<void> {
  const permissions = await computeEffectivePermissions(membershipId);
  if (!permissions.has(permission)) {
    throw new AuthorizationError(`Missing required permission: ${permission}`);
  }
}
