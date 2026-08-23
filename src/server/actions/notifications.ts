"use server";

import { revalidatePath } from "next/cache";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow } from "@/lib/auth/session";
import * as notificationService from "@/server/services/notification-service";

export async function markNotificationRead(notificationId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  const db = getScopedPrisma(membership.companyId);
  await notificationService.markNotificationRead(db, membership.membershipId, notificationId);
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const membership = await requireMembershipOrThrow();
  const db = getScopedPrisma(membership.companyId);
  await notificationService.markAllNotificationsRead(db, membership.membershipId);
  revalidatePath("/notifications");
}
