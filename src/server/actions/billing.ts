"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireMembershipOrThrow, requirePermission, getSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import * as billingService from "@/server/services/billing-service";
import { PaystackNotConfiguredError } from "@/lib/paystack/client";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string };

export async function startSubscriptionCheckout(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.BILLING_MANAGE);

  const planId = String(formData.get("planId") ?? "");
  if (!planId) {
    return { error: "Select a plan." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "";
  let checkoutUrl: string;

  try {
    const result = await billingService.startCheckout(
      membership.companyId,
      membership.membershipId,
      planId,
      session.user.email,
      baseUrl,
    );
    checkoutUrl = result.authorizationUrl;
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      return { error: err.message };
    }
    return { error: err instanceof billingService.BillingError ? err.message : "Could not start checkout." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  await db.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "billing.checkout_started",
      entityType: "Subscription",
      entityId: membership.companyId,
      metadata: { planId },
      ipAddress: h.get("x-forwarded-for"),
      userAgent: h.get("user-agent"),
    });
  });

  redirect(checkoutUrl);
}
