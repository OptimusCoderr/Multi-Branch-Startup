import Link from "next/link";
import { headers } from "next/headers";
import { requireMembershipOrThrow } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import * as billingService from "@/server/services/billing-service";
import { writeAuditLog } from "@/server/services/audit-service";

async function activate(membershipId: string, companyId: string, txReference: string): Promise<{ ok: boolean; title: string }> {
  try {
    await billingService.activateSubscriptionFromTransaction(txReference, companyId);

    const db = getScopedPrisma(companyId);
    const h = await headers();
    await db.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        companyId,
        actorMembershipId: membershipId,
        action: "billing.subscription_activated",
        entityType: "Subscription",
        entityId: companyId,
        metadata: { reference: txReference },
        ipAddress: h.get("x-forwarded-for"),
        userAgent: h.get("user-agent"),
      });
    });

    return { ok: true, title: "Subscription activated" };
  } catch (err) {
    return { ok: false, title: err instanceof Error ? err.message : "Payment could not be verified" };
  }
}

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { reference, trxref } = await searchParams;
  const membership = await requireMembershipOrThrow();
  const txReference = reference ?? trxref;

  const result = txReference
    ? await activate(membership.membershipId, membership.companyId, txReference)
    : { ok: false, title: "Missing transaction reference" };

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className={`text-xl font-semibold ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{result.title}</h1>
      <Link href="/settings/billing" className="text-sm text-[var(--brand-primary)] hover:underline">
        Back to billing settings
      </Link>
    </div>
  );
}
