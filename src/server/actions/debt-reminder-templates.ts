"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { debtReminderTemplateSchema } from "@/lib/validation/debt-reminder-template.schema";
import * as templateService from "@/server/services/debt-reminder-template-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof templateService.DebtReminderTemplateError) return err.message;
  return fallback;
}

export async function createReminderTemplate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const parsed = debtReminderTemplateSchema.safeParse({
    name: formData.get("name"),
    message: formData.get("message"),
    isDefault: formData.get("isDefault"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid template details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const template = await templateService.createReminderTemplate(tx, membership.companyId, parsed.data);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "debt_reminder_template.created",
        entityType: "DebtReminderTemplate",
        entityId: template.id,
        metadata: { name: template.name, isDefault: template.isDefault },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not create the template.") };
  }

  revalidatePath("/settings/debt-reminders");
  return { error: "" };
}

export async function updateReminderTemplate(
  templateId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const parsed = debtReminderTemplateSchema.safeParse({
    name: formData.get("name"),
    message: formData.get("message"),
    isDefault: formData.get("isDefault"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid template details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const template = await templateService.updateReminderTemplate(tx, templateId, parsed.data);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "debt_reminder_template.updated",
        entityType: "DebtReminderTemplate",
        entityId: template.id,
        metadata: { name: template.name, isDefault: template.isDefault },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not update the template.") };
  }

  revalidatePath("/settings/debt-reminders");
  return { error: "" };
}

export async function setDefaultReminderTemplate(templateId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const template = await templateService.setDefaultReminderTemplate(tx, templateId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "debt_reminder_template.set_default",
      entityType: "DebtReminderTemplate",
      entityId: template.id,
      metadata: { name: template.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/settings/debt-reminders");
}

export async function deleteReminderTemplate(templateId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const template = await templateService.deleteReminderTemplate(tx, templateId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "debt_reminder_template.deleted",
      entityType: "DebtReminderTemplate",
      entityId: templateId,
      metadata: { name: template.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/settings/debt-reminders");
}
