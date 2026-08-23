import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { sendSms, SmsNotConfiguredError } from "@/lib/notifications/sms-client";
import { writeAuditLog } from "@/server/services/audit-service";
import { createPaymentLinkToken } from "@/lib/auth/payment-link";
import { renderReminderMessage, LEGACY_DEFAULT_TEMPLATE_MESSAGE } from "@/server/services/debt-reminder-template-service";

type ScopedClient = Pick<
  ReturnType<typeof getScopedPrisma>,
  "company" | "customer" | "sale" | "creditNote" | "debtReminder" | "debtReminderTemplate" | "auditLog" | "$transaction"
>;

// Don't re-message the same customer more than once every few days even
// if this runs daily and their balance is still overdue — capped at 3
// days regardless of the company's overdue threshold, so a company that
// sets a 1-day threshold can't accidentally spam a customer daily.
const MIN_COOLDOWN_DAYS = 3;

export type DebtReminderRunSummary = {
  configured: boolean;
  candidates: number;
  sent: number;
  failed: number;
  // True when the run stopped early because reminderCreditBalance hit 0 —
  // distinct from `configured: false` (no SMS provider at all), since this
  // means sending works fine, the company just needs to top up credits.
  outOfCredits: boolean;
};

type Candidate = {
  customerId: string;
  name: string;
  phone: string;
  outstanding: Prisma.Decimal;
  representativeSaleId: string;
  reminderTemplateId: string | null;
};

async function findCandidates(db: ScopedClient, companyId: string, daysOverdue: number): Promise<Candidate[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(now.getTime() - MIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const overdueSales = await db.sale.findMany({
    where: {
      status: { not: "VOIDED" },
      customerId: { not: null },
      dueDate: { lt: cutoff },
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, customerId: true, grandTotal: true, amountPaid: true },
  });
  if (overdueSales.length === 0) return [];

  const creditNotes = await db.creditNote.findMany({
    where: { saleId: { in: overdueSales.map((s) => s.id) }, status: "ISSUED" },
    select: { saleId: true, amount: true },
  });
  const creditedBySaleId = new Map<string, Prisma.Decimal>();
  for (const cn of creditNotes) {
    creditedBySaleId.set(cn.saleId, (creditedBySaleId.get(cn.saleId) ?? new Prisma.Decimal(0)).add(cn.amount));
  }

  const outstandingByCustomer = new Map<string, Prisma.Decimal>();
  // The oldest still-payable sale per customer (sales are ordered by
  // dueDate ascending above, so the first one seen per customer is it) —
  // that's what the reminder's pay-link points at, since a customer can
  // owe across several sales but recordPayment() only ever applies to one.
  const representativeSaleByCustomer = new Map<string, string>();
  for (const sale of overdueSales) {
    if (!sale.customerId) continue;
    const credited = creditedBySaleId.get(sale.id) ?? new Prisma.Decimal(0);
    const outstanding = sale.grandTotal.sub(sale.amountPaid).sub(credited);
    if (outstanding.lte(0)) continue;
    outstandingByCustomer.set(sale.customerId, (outstandingByCustomer.get(sale.customerId) ?? new Prisma.Decimal(0)).add(outstanding));
    if (!representativeSaleByCustomer.has(sale.customerId)) {
      representativeSaleByCustomer.set(sale.customerId, sale.id);
    }
  }

  if (outstandingByCustomer.size === 0) return [];

  const eligibleCustomers = await db.customer.findMany({
    where: {
      id: { in: [...outstandingByCustomer.keys()] },
      isActive: true,
      remindersEnabled: true,
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true, reminderTemplateId: true },
  });
  if (eligibleCustomers.length === 0) return [];

  // Only a successfully SENT reminder should start the cooldown — a FAILED
  // row (transient SMS-provider error, not the customer's fault) must not
  // count as "recently reminded," or a real overdue debtor gets silently
  // skipped for days despite never actually receiving a message.
  const recentlyReminded = await db.debtReminder.findMany({
    where: { customerId: { in: eligibleCustomers.map((c) => c.id) }, createdAt: { gte: cooldownCutoff }, status: "SENT" },
    select: { customerId: true },
  });
  const recentlyRemindedIds = new Set(recentlyReminded.map((r) => r.customerId));

  const candidates: Candidate[] = [];
  for (const customer of eligibleCustomers) {
    if (recentlyRemindedIds.has(customer.id)) continue;
    if (!customer.phone) continue;
    const outstanding = outstandingByCustomer.get(customer.id);
    const representativeSaleId = representativeSaleByCustomer.get(customer.id);
    if (!outstanding || !representativeSaleId) continue;
    candidates.push({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      outstanding,
      representativeSaleId,
      reminderTemplateId: customer.reminderTemplateId,
    });
  }

  return candidates;
}

/**
 * Finds every customer with an overdue, un-reminded balance and messages
 * them. Never throws for an unconfigured SMS provider or an individual
 * send failure — both come back in the summary, since this is meant to
 * be called from an unattended cron job as much as a manual "send now"
 * button, and neither caller wants a crash for "no API key set yet".
 */
export async function sendDebtReminders(
  db: ScopedClient,
  companyId: string,
  triggeredByMembershipId: string | null,
): Promise<DebtReminderRunSummary> {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company || !company.debtReminderEnabled) {
    return { configured: true, candidates: 0, sent: 0, failed: 0, outOfCredits: false };
  }

  const candidates = await findCandidates(db, companyId, company.debtReminderDaysOverdue);
  if (candidates.length === 0) {
    return { configured: true, candidates: 0, sent: 0, failed: 0, outOfCredits: false };
  }

  let sent = 0;
  let failed = 0;
  let creditBalance = company.reminderCreditBalance;

  // Fetched once per run, not per candidate — every template a candidate
  // might reference (their own pick, plus whichever one is the company's
  // default) in a single query.
  const referencedTemplateIds = [...new Set(candidates.map((c) => c.reminderTemplateId).filter((id): id is string => !!id))];
  const [explicitTemplates, defaultTemplate] = await Promise.all([
    referencedTemplateIds.length > 0
      ? db.debtReminderTemplate.findMany({ where: { id: { in: referencedTemplateIds } }, select: { id: true, message: true } })
      : Promise.resolve([]),
    db.debtReminderTemplate.findFirst({ where: { isDefault: true }, select: { message: true } }),
  ]);
  const templateMessageById = new Map(explicitTemplates.map((t) => [t.id, t.message]));
  const fallbackMessage = defaultTemplate?.message ?? LEGACY_DEFAULT_TEMPLATE_MESSAGE;

  for (const candidate of candidates) {
    // Checked per-candidate (not once up front) since the balance only
    // ever decreases within this loop — stop the moment it actually runs
    // out rather than either overspending or refusing a run that had
    // enough credits for at least some of today's candidates.
    if (creditBalance <= 0) {
      return { configured: true, candidates: candidates.length, sent, failed, outOfCredits: true };
    }

    const baseUrl = process.env.BETTER_AUTH_URL ?? "";
    const payLink = baseUrl ? `${baseUrl}/pay/${createPaymentLinkToken(candidate.representativeSaleId)}` : null;
    // Per-customer template first, else the company's designated default,
    // else the original hardcoded wording — see the fetch above.
    const templateMessage =
      (candidate.reminderTemplateId && templateMessageById.get(candidate.reminderTemplateId)) || fallbackMessage;
    const message = renderReminderMessage(templateMessage, {
      name: candidate.name,
      company: company.name,
      amount: candidate.outstanding.toFixed(2),
      currency: company.currency,
      payLink,
    });

    let result: { success: boolean; providerResponse?: unknown; error?: string };
    try {
      result = await sendSms(candidate.phone, message);
    } catch (err) {
      if (err instanceof SmsNotConfiguredError) {
        return { configured: false, candidates: candidates.length, sent, failed, outOfCredits: false };
      }
      result = { success: false, error: err instanceof Error ? err.message : "Unknown error sending SMS." };
    }

    if (result.success) {
      sent += 1;
      creditBalance -= 1;
    } else {
      failed += 1;
    }

    await db.$transaction(async (tx) => {
      await tx.debtReminder.create({
        data: {
          companyId,
          customerId: candidate.customerId,
          channel: "SMS",
          message,
          outstandingSnapshot: candidate.outstanding,
          status: result.success ? "SENT" : "FAILED",
          providerResponse: result.providerResponse as Prisma.InputJsonValue | undefined,
          error: result.error ?? null,
          triggeredByMembershipId,
        },
      });

      // Only a successfully SENT message consumes a credit — a provider-side
      // failure (bad number, transient error) shouldn't cost the company
      // anything.
      if (result.success) {
        await tx.company.update({ where: { id: companyId }, data: { reminderCreditBalance: { decrement: 1 } } });
      }

      await writeAuditLog(tx, {
        companyId,
        actorMembershipId: triggeredByMembershipId,
        action: result.success ? "debt_reminder.sent" : "debt_reminder.failed",
        entityType: "Customer",
        entityId: candidate.customerId,
        metadata: { outstanding: candidate.outstanding.toString(), ...(result.error ? { error: result.error } : {}) },
      });
    });
  }

  return { configured: true, candidates: candidates.length, sent, failed, outOfCredits: false };
}
