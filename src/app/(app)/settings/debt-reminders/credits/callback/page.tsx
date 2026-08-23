import Link from "next/link";
import { headers } from "next/headers";
import { requireMembershipOrThrow } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import * as reminderCreditsService from "@/server/services/reminder-credits-service";
import { writeAuditLog } from "@/server/services/audit-service";

async function confirm(membershipId: string, companyId: string, txReference: string): Promise<{ ok: boolean; title: string }> {
  try {
    const { credits, alreadyProcessed } = await reminderCreditsService.confirmCreditPurchaseFromTransaction(txReference, companyId);

    if (!alreadyProcessed) {
      const db = getScopedPrisma(companyId);
      const h = await headers();
      await db.$transaction(async (tx) => {
        await writeAuditLog(tx, {
          companyId,
          actorMembershipId: membershipId,
          action: "reminder_credits.purchased",
          entityType: "Company",
          entityId: companyId,
          metadata: { reference: txReference, credits },
          ipAddress: h.get("x-forwarded-for"),
          userAgent: h.get("user-agent"),
        });
      });
    }

    return { ok: true, title: `${credits} reminder credits added` };
  } catch (err) {
    return { ok: false, title: err instanceof Error ? err.message : "Payment could not be verified" };
  }
}

export default async function ReminderCreditsCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { reference, trxref } = await searchParams;
  const membership = await requireMembershipOrThrow();
  const txReference = reference ?? trxref;

  const result = txReference
    ? await confirm(membership.membershipId, membership.companyId, txReference)
    : { ok: false, title: "Missing transaction reference" };

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className={`text-xl font-semibold ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{result.title}</h1>
      <Link href="/settings/debt-reminders" className="text-sm text-[var(--brand-primary)] hover:underline">
        Back to debt reminder settings
      </Link>
    </div>
  );
}
