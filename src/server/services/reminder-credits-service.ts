import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import * as paystack from "@/lib/paystack/client";
import { parsePlanFeatures } from "@/lib/billing/plan-features";

export class ReminderCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderCreditsError";
  }
}

/**
 * Fixed packs rather than a free-entry amount — keeps the Paystack
 * metadata/verification round-trip simple (a known credits-per-kobo
 * mapping to check the payment against, not an arbitrary client-supplied
 * number) and gives a predictable per-credit price a merchant can reason
 * about.
 */
export const CREDIT_PACKS = {
  pack_50: { credits: 50, priceKobo: 250_000 }, // NGN 2,500 (NGN50/credit)
  pack_200: { credits: 200, priceKobo: 800_000 }, // NGN 8,000 (NGN40/credit)
  pack_500: { credits: 500, priceKobo: 1_500_000 }, // NGN 15,000 (NGN30/credit)
} as const;
export type CreditPackId = keyof typeof CREDIT_PACKS;

export function isCreditPackId(value: string): value is CreditPackId {
  return value in CREDIT_PACKS;
}

export async function startCreditPurchase(
  companyId: string,
  membershipId: string,
  packId: CreditPackId,
  email: string,
  baseUrl: string,
) {
  const pack = CREDIT_PACKS[packId];

  const reference = `credits_${companyId}_${Date.now()}`;

  return paystack.initializeTransaction({
    email,
    amountKobo: pack.priceKobo,
    callbackUrl: `${baseUrl}/settings/debt-reminders/credits/callback`,
    reference,
    // `purpose` is what tells the shared Paystack webhook (billing-service.ts)
    // this charge.success event is a credit top-up, not a subscription
    // renewal — without it, a credit purchase would be misread as a
    // renewal and wrongly reset the company's billing period.
    metadata: { purpose: "reminder_credits", companyId, membershipId, packId, credits: pack.credits },
  });
}

/**
 * Verifies a Paystack transaction and credits the balance exactly once —
 * called from both the redirect callback page and the webhook, since
 * either can arrive first (or the browser callback might never happen at
 * all if the user closes the tab). `ReminderCreditPurchase.reference` is
 * unique, so whichever call loses the race just reads back the winner's
 * row instead of double-crediting.
 */
export async function confirmCreditPurchaseFromTransaction(
  reference: string,
  expectedCompanyId: string | null,
): Promise<{ credits: number; alreadyProcessed: boolean }> {
  const existing = await prisma.reminderCreditPurchase.findUnique({ where: { reference } });
  if (existing) {
    if (expectedCompanyId && existing.companyId !== expectedCompanyId) {
      throw new ReminderCreditsError("This transaction does not belong to your company.");
    }
    return { credits: existing.credits, alreadyProcessed: true };
  }

  const verified = await paystack.verifyTransaction(reference);
  if (verified.status !== "success") {
    throw new ReminderCreditsError(`Payment was not completed (status: ${verified.status}).`);
  }

  const purpose = verified.metadata.purpose as string | undefined;
  const companyId = verified.metadata.companyId as string | undefined;
  const credits = verified.metadata.credits as number | undefined;
  if (purpose !== "reminder_credits" || !companyId || !credits) {
    throw new ReminderCreditsError("This transaction is missing the credit-purchase metadata Paystack should have echoed back.");
  }
  if (expectedCompanyId && companyId !== expectedCompanyId) {
    throw new ReminderCreditsError("This transaction does not belong to your company.");
  }

  try {
    await prisma.$transaction([
      prisma.reminderCreditPurchase.create({ data: { companyId, reference, credits, priceKobo: verified.amountKobo } }),
      prisma.company.update({ where: { id: companyId }, data: { reminderCreditBalance: { increment: credits } } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const race = await prisma.reminderCreditPurchase.findUniqueOrThrow({ where: { reference } });
      return { credits: race.credits, alreadyProcessed: true };
    }
    throw err;
  }

  return { credits, alreadyProcessed: false };
}

const REPLENISH_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Tops up a company's reminder-credit balance with its plan's monthly
 * allotment on each successful subscription renewal. Guarded by a minimum
 * interval (not "once per currentPeriodStart") because the redirect
 * callback and the webhook can both fire for the same renewal within
 * moments of each other — a same-day guard is enough to prevent a double
 * top-up without needing a second idempotency table for something that
 * only ever happens ~once a month.
 */
export async function replenishMonthlyCreditsIfDue(companyId: string, planId: string): Promise<void> {
  const [company, plan] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { reminderCreditsRefreshedAt: true } }),
    prisma.plan.findUnique({ where: { id: planId }, select: { features: true } }),
  ]);
  if (!company) return;

  const included = parsePlanFeatures(plan?.features).includedReminderCredits;
  if (!included) return;

  const now = new Date();
  if (company.reminderCreditsRefreshedAt && now.getTime() - company.reminderCreditsRefreshedAt.getTime() < REPLENISH_MIN_INTERVAL_MS) {
    return;
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { reminderCreditBalance: { increment: included }, reminderCreditsRefreshedAt: now },
  });
}
