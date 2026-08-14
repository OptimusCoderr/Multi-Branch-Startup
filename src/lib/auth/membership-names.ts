import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedDb = Pick<ReturnType<typeof getScopedPrisma>, "membership">;

/**
 * Resolves a batch of membershipId values (the plain-string accountability
 * fields on StockTransfer/AuditLog — not Prisma relations, deliberately, so
 * removing a Membership never cascades into rewriting historical records)
 * to display names, for rendering "requested by X, approved by Y" timelines.
 */
export async function resolveMembershipNames(
  db: ScopedDb,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();

  const memberships = await db.membership.findMany({
    where: { id: { in: uniqueIds } },
    include: { user: true },
  });

  return new Map(memberships.map((m) => [m.id, m.displayName ?? m.user.name ?? m.user.email]));
}
