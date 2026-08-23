import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "notification" | "membership">;

export type NotificationKind =
  | "SALE_FLAGGED"
  | "SALE_FLAG_ESCALATED"
  | "SALE_FLAG_RESOLVED"
  | "TRANSFER_DISCREPANCY"
  | "LOW_STOCK"
  | "SALE_VOIDED"
  | "BACKUP_DOWNLOADED"
  | "SALES_RESET";

/** In-app only — no email/SMS/push. Called from inside the same transaction as whatever triggered it, same convention as writeAuditLog. */
export async function createNotification(
  tx: ScopedTx,
  companyId: string,
  input: { membershipId: string; type: NotificationKind; title: string; body: string; entityType?: string; entityId?: string },
) {
  return tx.notification.create({
    data: {
      companyId,
      membershipId: input.membershipId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
}

export async function createNotifications(
  tx: ScopedTx,
  companyId: string,
  membershipIds: string[],
  input: { type: NotificationKind; title: string; body: string; entityType?: string; entityId?: string },
) {
  for (const membershipId of membershipIds) {
    await createNotification(tx, companyId, { ...input, membershipId });
  }
}

export async function countUnreadNotifications(tx: ScopedTx, membershipId: string): Promise<number> {
  return tx.notification.count({ where: { membershipId, readAt: null } });
}

export async function markNotificationRead(tx: ScopedTx, membershipId: string, notificationId: string) {
  // where includes membershipId, not just id — a membership can only ever
  // mark its own notifications read, enforced at the query level rather
  // than trusting the caller to have already checked ownership.
  return tx.notification.updateMany({ where: { id: notificationId, membershipId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(tx: ScopedTx, membershipId: string) {
  return tx.notification.updateMany({ where: { membershipId, readAt: null }, data: { readAt: new Date() } });
}

/**
 * Owner + Admin memberships — the shared "who gets alerted about a
 * company-wide integrity concern" audience for TRANSFER_DISCREPANCY and
 * LOW_STOCK notifications, same role set the sale-flag escalation cron
 * job resolves for its own reviewer audience (see
 * api/cron/sale-flag-deadlines/route.ts), just Owner+Admin instead of
 * Owner+Branch Manager since these are inventory/ops concerns rather
 * than a specific branch's accountability.
 */
export async function getOwnerAndAdminMembershipIds(tx: ScopedTx): Promise<string[]> {
  const memberships = await tx.membership.findMany({
    where: { status: "ACTIVE", role: { isSystem: true, name: { in: ["Owner", "Admin"] } } },
    select: { id: true },
  });
  return memberships.map((m) => m.id);
}
