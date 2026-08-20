import "server-only";
import { NextResponse } from "next/server";
import { getSession, getCurrentMembership, computeEffectivePermissions } from "@/lib/auth/session";
import type { AuthenticatedMembership } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/permissions";
import { RateLimitError } from "@/lib/rate-limit";

/**
 * HTTP-flavored counterpart to requireMembershipOrThrow()/requirePermission()
 * (src/lib/auth/session.ts) — those are built for Server Actions, which
 * communicate failure by throwing and don't carry an HTTP status. Route
 * Handlers under /api/mobile need an actual status code (401 vs 403 vs 400),
 * so this is a thin, additive layer rather than a change to the existing
 * functions every other part of the app already depends on.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireMobileMembership(): Promise<AuthenticatedMembership> {
  const session = await getSession();
  if (!session) throw new ApiError("Not signed in.", 401);

  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("No active company membership for this account.", 403);

  return membership;
}

export async function requireMobilePermission(membershipId: string, permission: PermissionKey): Promise<void> {
  const permissions = await computeEffectivePermissions(membershipId);
  if (!permissions.has(permission)) {
    throw new ApiError(`Missing required permission: ${permission}`, 403);
  }
}

/**
 * Maps a caught error to a JSON response. ApiError carries its own status;
 * any domain error class passed in `knownErrors` is reported as 400 with
 * its message (the same "surface expected validation failures, never leak
 * internals" discipline every Server Action's friendlyError() already
 * follows); anything else is an unexpected failure — logged, and returned
 * as a generic 500 so internal details never reach the client.
 */
export function handleApiError(err: unknown, knownErrors: (new (...args: never[]) => Error)[] = []): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json({ error: err.message }, { status: 429 });
  }
  for (const ErrorClass of knownErrors) {
    if (err instanceof ErrorClass) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
