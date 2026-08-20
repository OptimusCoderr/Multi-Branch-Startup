"use server";

import { revalidatePath } from "next/cache";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { sendDebtReminders } from "@/server/services/debt-reminder-service";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

type SendResult = { error: string; summary?: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState; this trigger takes no form fields
export async function sendDebtRemindersNow(_prev: SendResult, _formData: FormData): Promise<SendResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_MANAGE);

  try {
    // A manual "send now" button is still an SMS-cost-incurring, staff-triggered
    // batch action — cap it the same way other cost-bearing actions are capped.
    checkRateLimit(`debt_reminders.send:${membership.companyId}`, { max: 10, windowMs: 60 * 60 * 1000 });
  } catch (err) {
    return { error: err instanceof RateLimitError ? err.message : "Too many reminder runs recently." };
  }

  const db = getScopedPrisma(membership.companyId);

  const result = await sendDebtReminders(db, membership.companyId, membership.membershipId);

  revalidatePath("/customers");

  if (!result.configured) {
    return { error: "SMS is not configured for this environment yet — add a real Termii API key to send reminders." };
  }
  if (result.candidates === 0) {
    return { error: "", summary: "No overdue customers were due a reminder right now." };
  }

  return { error: "", summary: `Reminded ${result.sent} of ${result.candidates} overdue customer(s)${result.failed > 0 ? ` (${result.failed} failed)` : ""}.` };
}
