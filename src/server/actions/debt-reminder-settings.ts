"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { debtReminderSettingsSchema } from "@/lib/validation/debt-reminder-settings.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string };

export async function updateDebtReminderSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const parsed = debtReminderSettingsSchema.safeParse({
    debtReminderEnabled: formData.get("debtReminderEnabled"),
    debtReminderDaysOverdue: formData.get("debtReminderDaysOverdue"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for");
  const userAgent = h.get("user-agent");

  await db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: membership.companyId },
      data: {
        debtReminderEnabled: parsed.data.debtReminderEnabled,
        debtReminderDaysOverdue: parsed.data.debtReminderDaysOverdue,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "debt_reminder_settings.updated",
      entityType: "Company",
      entityId: membership.companyId,
      metadata: parsed.data,
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/settings/debt-reminders");
  return { error: "" };
}
