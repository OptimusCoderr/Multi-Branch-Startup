import "server-only";
import { prisma } from "@/lib/db/prisma";
import * as paystack from "@/lib/paystack/client";

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

export async function activateSubscriptionFromTransaction(reference: string): Promise<{ companyId: string }> {
  const verified = await paystack.verifyTransaction(reference);
  if (verified.status !== "success") {
    throw new BillingError(`Payment was not completed (status: ${verified.status}).`);
  }

  const companyId = verified.metadata.companyId as string | undefined;
  const planId = verified.metadata.planId as string | undefined;
  if (!companyId || !planId) {
    throw new BillingError("This transaction is missing the billing metadata Paystack should have echoed back.");
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
