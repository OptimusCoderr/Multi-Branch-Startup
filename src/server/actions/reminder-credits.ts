"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireMembershipOrThrow, requirePermission, getSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import * as reminderCreditsService from "@/server/services/reminder-credits-service";
import { PaystackNotConfiguredError } from "@/lib/paystack/client";
import { writeAuditLog } from "@/server/services/audit-service";
import { startCreditPurchaseSchema } from "@/lib/validation/reminder-credits.schema";

type ActionResult = { error: string };

export async function startCreditPurchase(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.BILLING_MANAGE);

  const parsed = startCreditPurchaseSchema.safeParse({ packId: formData.get("packId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Select a credit pack." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "";
  let checkoutUrl: string;

  try {
    const result = await reminderCreditsService.startCreditPurchase(
      membership.companyId,
      membership.membershipId,
      parsed.data.packId,
      session.user.email,
      baseUrl,
    );
    checkoutUrl = result.authorizationUrl;
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      return { error: err.message };
    }
    return { error: err instanceof reminderCreditsService.ReminderCreditsError ? err.message : "Could not start checkout." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  await db.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "reminder_credits.checkout_started",
      entityType: "Company",
      entityId: membership.companyId,
      metadata: { packId: parsed.data.packId },
      ipAddress: h.get("x-forwarded-for"),
      userAgent: h.get("user-agent"),
    });
  });

  redirect(checkoutUrl);
}
