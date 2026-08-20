import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { sendDebtReminders } from "@/server/services/debt-reminder-service";

/**
 * Fired by Vercel Cron (see vercel.json) once a day. Not a Server Action —
 * it's called by Vercel's scheduler, not a signed-in browser, so it's
 * protected by a shared secret instead of a session. Iterates every
 * company that has opted into debt reminders (off by default) and has an
 * active subscription; a company with reminders enabled but a lapsed
 * subscription is skipped, same as every other feature behind the
 * billing gate.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await prisma.company.findMany({
    where: { debtReminderEnabled: true, status: { not: "SUSPENDED" } },
    select: { id: true },
  });

  const results: { companyId: string; configured: boolean; candidates: number; sent: number; failed: number; skipped?: string }[] = [];

  for (const company of companies) {
    const subscription = await prisma.subscription.findUnique({ where: { companyId: company.id }, include: { plan: true } });
    if (!isSubscriptionActive(subscription)) {
      results.push({ companyId: company.id, configured: true, candidates: 0, sent: 0, failed: 0, skipped: "subscription inactive" });
      continue;
    }

    const db = getScopedPrisma(company.id);
    const summary = await sendDebtReminders(db, company.id, null);
    results.push({ companyId: company.id, ...summary });
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    companiesProcessed: results.length,
    results,
  });
}
