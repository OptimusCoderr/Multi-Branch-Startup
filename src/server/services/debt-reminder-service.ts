import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { sendSms, SmsNotConfiguredError } from "@/lib/notifications/sms-client";
import { writeAuditLog } from "@/server/services/audit-service";

type ScopedClient = Pick<
  ReturnType<typeof getScopedPrisma>,
  "company" | "customer" | "sale" | "debtReminder" | "auditLog" | "$transaction"
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
};

type Candidate = { customerId: string; name: string; phone: string; outstanding: Prisma.Decimal };

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
    select: { customerId: true, grandTotal: true, amountPaid: true },
  });

  const outstandingByCustomer = new Map<string, Prisma.Decimal>();
  for (const sale of overdueSales) {
    if (!sale.customerId) continue;
    const outstanding = sale.grandTotal.sub(sale.amountPaid);
    if (outstanding.lte(0)) continue;
    outstandingByCustomer.set(sale.customerId, (outstandingByCustomer.get(sale.customerId) ?? new Prisma.Decimal(0)).add(outstanding));
  }

  if (outstandingByCustomer.size === 0) return [];

  const eligibleCustomers = await db.customer.findMany({
    where: {
      id: { in: [...outstandingByCustomer.keys()] },
      isActive: true,
      remindersEnabled: true,
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
  });
  if (eligibleCustomers.length === 0) return [];

  const recentlyReminded = await db.debtReminder.findMany({
    where: { customerId: { in: eligibleCustomers.map((c) => c.id) }, createdAt: { gte: cooldownCutoff } },
    select: { customerId: true },
  });
  const recentlyRemindedIds = new Set(recentlyReminded.map((r) => r.customerId));

  const candidates: Candidate[] = [];
  for (const customer of eligibleCustomers) {
    if (recentlyRemindedIds.has(customer.id)) continue;
    if (!customer.phone) continue;
    const outstanding = outstandingByCustomer.get(customer.id);
    if (!outstanding) continue;
    candidates.push({ customerId: customer.id, name: customer.name, phone: customer.phone, outstanding });
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
    return { configured: true, candidates: 0, sent: 0, failed: 0 };
  }

  const candidates = await findCandidates(db, companyId, company.debtReminderDaysOverdue);
  if (candidates.length === 0) {
    return { configured: true, candidates: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const message = `Hi ${candidate.name}, this is a reminder from ${company.name} that you have an outstanding balance of ${company.currency} ${candidate.outstanding.toFixed(2)}. Please arrange payment at your earliest convenience. Thank you.`;

    let result: { success: boolean; providerResponse?: unknown; error?: string };
    try {
      result = await sendSms(candidate.phone, message);
    } catch (err) {
      if (err instanceof SmsNotConfiguredError) {
        return { configured: false, candidates: candidates.length, sent, failed };
      }
      result = { success: false, error: err instanceof Error ? err.message : "Unknown error sending SMS." };
    }

    if (result.success) sent += 1;
    else failed += 1;

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

  return { configured: true, candidates: candidates.length, sent, failed };
}
