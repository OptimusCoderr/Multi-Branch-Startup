import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "debtReminderTemplate" | "customer">;

export class DebtReminderTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DebtReminderTemplateError";
  }
}

// The exact wording sendDebtReminders() used before templates existed —
// kept as the ultimate fallback so a company that never creates a
// template sees zero change in behavior.
export const LEGACY_DEFAULT_TEMPLATE_MESSAGE =
  "Hi {name}, this is a reminder from {company} that you have an outstanding balance of {currency} {amount}. Pay now: {pay_link} Thank you for your business with {company}.";

/** Every placeholder a template's message may use, for the settings-page cheat sheet and any future validation. */
export const TEMPLATE_PLACEHOLDERS = ["{name}", "{company}", "{amount}", "{currency}", "{pay_link}"] as const;

export function renderReminderMessage(
  template: string,
  vars: { name: string; company: string; amount: string; currency: string; payLink: string | null },
): string {
  return template
    .replaceAll("{name}", vars.name)
    .replaceAll("{company}", vars.company)
    .replaceAll("{amount}", vars.amount)
    .replaceAll("{currency}", vars.currency)
    .replaceAll("{pay_link}", vars.payLink ?? "");
}

export async function createReminderTemplate(
  tx: ScopedTx,
  companyId: string,
  input: { name: string; message: string; isDefault: boolean },
) {
  const existing = await tx.debtReminderTemplate.findFirst({ where: { name: input.name } });
  if (existing) throw new DebtReminderTemplateError(`A template named "${input.name}" already exists.`);

  // Only one template may be the default at a time — application-enforced
  // (not a DB constraint, Prisma has no partial unique index), so unset
  // any current default before creating this one as the new one.
  if (input.isDefault) {
    await tx.debtReminderTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  return tx.debtReminderTemplate.create({
    data: { companyId, name: input.name, message: input.message, isDefault: input.isDefault },
  });
}

export async function updateReminderTemplate(
  tx: ScopedTx,
  templateId: string,
  input: { name: string; message: string; isDefault: boolean },
) {
  const template = await tx.debtReminderTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new DebtReminderTemplateError("Template not found.");

  const nameTaken = await tx.debtReminderTemplate.findFirst({ where: { name: input.name, id: { not: templateId } } });
  if (nameTaken) throw new DebtReminderTemplateError(`A template named "${input.name}" already exists.`);

  if (input.isDefault && !template.isDefault) {
    await tx.debtReminderTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  return tx.debtReminderTemplate.update({
    where: { id: templateId },
    data: { name: input.name, message: input.message, isDefault: input.isDefault },
  });
}

export async function setDefaultReminderTemplate(tx: ScopedTx, templateId: string) {
  const template = await tx.debtReminderTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new DebtReminderTemplateError("Template not found.");
  if (template.isDefault) return template;

  await tx.debtReminderTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  return tx.debtReminderTemplate.update({ where: { id: templateId }, data: { isDefault: true } });
}

/**
 * Deleting a template a customer had explicitly picked doesn't fail or
 * orphan them — the FK is ON DELETE SET NULL, so they silently fall back
 * to the company's default template (or the legacy hardcoded message, if
 * there is none) on their very next reminder.
 */
export async function deleteReminderTemplate(tx: ScopedTx, templateId: string) {
  const template = await tx.debtReminderTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new DebtReminderTemplateError("Template not found.");
  await tx.debtReminderTemplate.delete({ where: { id: templateId } });
  return template;
}
