import "server-only";
import { prisma } from "@/lib/db/prisma";
import * as paystack from "@/lib/paystack/client";
import { confirmCreditPurchaseFromTransaction, replenishMonthlyCreditsIfDue } from "@/server/services/reminder-credits-service";
import { confirmDebtorPayment } from "@/server/services/debtor-payment-service";

export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingError";
  }
}

const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * v1 uses Paystack's Transactions API (a one-time charge per billing
 * period, verified on redirect and renewed by webhook) rather than its
 * Subscriptions API (which requires binding a saved card authorization for
 * recurring auto-charging). That's a real scope trim, not an oversight —
 * true auto-renewal is a natural follow-up once there's a live Paystack
 * account to build and test it against.
 */
export async function startCheckout(
  companyId: string,
  membershipId: string,
  planId: string,
  email: string,
  baseUrl: string,
) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    throw new BillingError("That plan is not available.");
  }

  const reference = `sub_${companyId}_${Date.now()}`;

  return paystack.initializeTransaction({
    email,
    amountKobo: plan.priceKobo,
    callbackUrl: `${baseUrl}/settings/billing/callback`,
    reference,
    metadata: { companyId, planId, membershipId },
  });
}

/**
 * `expectedCompanyId` must be the calling session's own company — the
 * transaction reference embedded in the redirect URL is otherwise a bare
 * string an attacker could copy from another company's browser history
 * and replay against their own session's callback to activate someone
 * else's subscription, or (worse) attribute that activation to the wrong
 * company in the audit trail. This check is the actual tenant-isolation
 * boundary here, since Paystack's own metadata can't be trusted to match
 * whoever is currently signed in.
 */
export async function activateSubscriptionFromTransaction(
  reference: string,
  expectedCompanyId: string,
): Promise<{ companyId: string }> {
  const verified = await paystack.verifyTransaction(reference);
  if (verified.status !== "success") {
    throw new BillingError(`Payment was not completed (status: ${verified.status}).`);
  }

  const companyId = verified.metadata.companyId as string | undefined;
  const planId = verified.metadata.planId as string | undefined;
  if (!companyId || !planId) {
    throw new BillingError("This transaction is missing the billing metadata Paystack should have echoed back.");
  }
  if (companyId !== expectedCompanyId) {
    throw new BillingError("This transaction does not belong to your company.");
  }

  const now = new Date();
  await prisma.subscription.update({
    where: { companyId },
    data: {
      planId,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + SUBSCRIPTION_PERIOD_MS),
      cancelAtPeriodEnd: false,
    },
  });
  await replenishMonthlyCreditsIfDue(companyId, planId);

  return { companyId };
}

/**
 * Applies a verified Paystack webhook event to a Subscription. Only two
 * event types are handled for now — the two the product spec explicitly
 * calls for (activate on success, flag on payment failure) — everything
 * else is accepted and ignored rather than erroring, since Paystack sends
 * many event types we don't act on and an unhandled one isn't a failure.
 */
export async function applyWebhookEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
  switch (eventType) {
    case "charge.success": {
      const metadata = data.metadata as Record<string, unknown> | undefined;
      const companyId = metadata?.companyId as string | undefined;
      if (!companyId) return;

      // Two very different things share this one Paystack event type — a
      // subscription renewal and a reminder-credit top-up — discriminated
      // by the metadata this app itself set when starting the checkout
      // (see startCheckout() and reminder-credits-service.ts's
      // startCreditPurchase()). Without this check a credit purchase would
      // be misread as a renewal and wrongly reset the billing period.
      if (metadata?.purpose === "reminder_credits") {
        const reference = data.reference as string | undefined;
        if (reference) await confirmCreditPurchaseFromTransaction(reference, companyId);
        return;
      }

      if (metadata?.purpose === "debtor_payment") {
        const reference = data.reference as string | undefined;
        const saleId = metadata.saleId as string | undefined;
        if (reference && saleId) await confirmDebtorPayment(reference, saleId);
        return;
      }

      const planId = metadata?.planId as string | undefined;
      const now = new Date();
      await prisma.subscription.updateMany({
        where: { companyId },
        data: {
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + SUBSCRIPTION_PERIOD_MS),
          cancelAtPeriodEnd: false,
        },
      });
      if (planId) await replenishMonthlyCreditsIfDue(companyId, planId);
      return;
    }

    case "invoice.payment_failed": {
      const metadata = data.metadata as Record<string, unknown> | undefined;
      const companyId = metadata?.companyId as string | undefined;
      if (!companyId) return;

      await prisma.subscription.updateMany({ where: { companyId }, data: { status: "PAST_DUE" } });
      return;
    }

    default:
      return;
  }
}
