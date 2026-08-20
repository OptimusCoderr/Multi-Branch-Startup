import { NextResponse } from "next/server";
import { requireMobileMembership, handleApiError } from "@/lib/api/mobile-auth";
import { computeEffectivePermissions } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";

/**
 * The mobile app's first call after signing in — everything it needs to
 * decide what to render: who you are, what you're allowed to do, and
 * whether the company's subscription is active (the same gate the
 * (gated) route group enforces for the web app, re-expressed as data
 * instead of a redirect since there's no route group to redirect within
 * on a native client).
 */
export async function GET() {
  try {
    const membership = await requireMobileMembership();
    const [permissions, subscription] = await Promise.all([
      computeEffectivePermissions(membership.membershipId),
      getSubscriptionForCompany(membership.companyId),
    ]);

    return NextResponse.json({
      membershipId: membership.membershipId,
      companyId: membership.companyId,
      companyName: membership.companyName,
      companyCurrency: membership.companyCurrency,
      roleName: membership.roleName,
      permissions: [...permissions],
      subscriptionActive: isSubscriptionActive(subscription),
      subscriptionStatus: subscription?.status ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
