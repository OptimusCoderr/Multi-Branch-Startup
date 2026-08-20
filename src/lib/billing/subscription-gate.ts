import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type GateSubscription = {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

/**
 * Whether the company's subscription currently allows using the app.
 * TRIALING is allowed until trialEndsAt; PAST_DUE gets a 7-day grace
 * period past the end of the last paid period (so a payment hiccup
 * doesn't lock a company out instantly); ACTIVE is always allowed;
 * everything else (CANCELLED, INCOMPLETE, or a subscription that somehow
 * doesn't exist) is not.
 */
export function isSubscriptionActive(subscription: GateSubscription | null, now: Date = new Date()): boolean {
  if (!subscription) return false;

  switch (subscription.status) {
    case "ACTIVE":
      return true;
    case "TRIALING":
      return !subscription.trialEndsAt || subscription.trialEndsAt > now;
    case "PAST_DUE": {
      if (!subscription.currentPeriodEnd) return false;
      const graceCutoff = new Date(subscription.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS);
      return now <= graceCutoff;
    }
    default:
      return false;
  }
}

// Memoized per request (React's cache(), not a cross-request cache) — the
// (app) layout (via getPlanFeaturesForCompany) and the nested (gated)
// layout both need this on every gated page load, and without dedup that
// was two identical Subscription+Plan queries per request instead of one.
export const getSubscriptionForCompany = cache(async (companyId: string) => {
  return prisma.subscription.findUnique({ where: { companyId }, include: { plan: true } });
});
