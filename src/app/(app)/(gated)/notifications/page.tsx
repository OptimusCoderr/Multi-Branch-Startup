import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";
import { PageHeader, Card, Button, EmptyState, Badge } from "@/components/ui";
import { Bell } from "lucide-react";

function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === "Sale") return `/sales/${entityId}`;
  return null;
}

export default async function NotificationsPage() {
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);

  const notifications = await db.notification.findMany({
    where: { membershipId: membership.membershipId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        actions={
          hasUnread ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="secondary">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const href = entityHref(n.entityType, n.entityId);
            return (
              <Card key={n.id} className={n.readAt ? "" : "border-[var(--brand-primary)]"}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {href ? (
                        <Link href={href} className="font-medium text-gray-900 dark:text-gray-100 hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                      )}
                      {!n.readAt && <Badge variant="brand">New</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.body}</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{n.createdAt.toLocaleString()}</p>
                  </div>
                  {!n.readAt && (
                    <form action={markNotificationRead.bind(null, n.id)}>
                      <Button type="submit" variant="link">
                        Mark as read
                      </Button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
