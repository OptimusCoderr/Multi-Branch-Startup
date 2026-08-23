"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { customerSchema } from "@/lib/validation/customer.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createCustomer(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_MANAGE);

  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    creditLimit: formData.get("creditLimit"),
    remindersEnabled: formData.get("remindersEnabled"),
    reminderTemplateId: formData.get("reminderTemplateId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid customer details." };
  }
  // A reminder can't be sent with nowhere to send it — web-only check (see
  // customer.schema.ts's comment on why this isn't baked into the shared
  // schema), so a customer can never be switched on for reminders here with
  // no phone number.
  if (parsed.data.remindersEnabled && !parsed.data.phone) {
    return { error: "A phone number is required to enable automated reminders for this customer." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  // Same "every FK must be verified to belong to this tenant" defense as
  // elsewhere (see transfer-service.ts) — getScopedPrisma only forces the
  // Customer row's own companyId, it never validates that a caller-supplied
  // reminderTemplateId actually points into this company.
  if (parsed.data.reminderTemplateId) {
    const template = await db.debtReminderTemplate.findUnique({ where: { id: parsed.data.reminderTemplateId } });
    if (!template) return { error: "Selected message template not found." };
  }

  await db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        companyId: membership.companyId,
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        creditLimit: parsed.data.creditLimit ?? null,
        remindersEnabled: parsed.data.remindersEnabled,
        reminderTemplateId: parsed.data.reminderTemplateId ?? null,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "customer.created",
      entityType: "Customer",
      entityId: customer.id,
      metadata: { name: customer.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(
  customerId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_MANAGE);

  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    creditLimit: formData.get("creditLimit"),
    remindersEnabled: formData.get("remindersEnabled"),
    reminderTemplateId: formData.get("reminderTemplateId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid customer details." };
  }
  if (parsed.data.remindersEnabled && !parsed.data.phone) {
    return { error: "A phone number is required to enable automated reminders for this customer." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.customer.findUnique({ where: { id: customerId } });
  if (!existing) {
    return { error: "Customer not found." };
  }

  if (parsed.data.reminderTemplateId) {
    const template = await db.debtReminderTemplate.findUnique({ where: { id: parsed.data.reminderTemplateId } });
    if (!template) return { error: "Selected message template not found." };
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        creditLimit: parsed.data.creditLimit ?? null,
        remindersEnabled: parsed.data.remindersEnabled,
        reminderTemplateId: parsed.data.reminderTemplateId ?? null,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "customer.updated",
      entityType: "Customer",
      entityId: updated.id,
      metadata: { before: { name: existing.name }, after: { name: updated.name } },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect("/customers");
}

export async function archiveCustomer(customerId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.customer.findUnique({ where: { id: customerId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: existing.isActive ? "customer.archived" : "customer.reactivated",
      entityType: "Customer",
      entityId: customerId,
      metadata: { name: existing.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
}
