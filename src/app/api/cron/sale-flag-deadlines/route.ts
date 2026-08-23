import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { escalateOverdueFlags } from "@/server/services/sale-flag-service";
import { createNotifications } from "@/server/services/notification-service";

/**
 * Fired by Vercel Cron (see vercel.json) — hourly, not daily, since a
 * SaleFlag's deadline is midnight in *that company's* timezone, and
 * companies are scattered across timezones. Same shared-secret auth as
 * /api/cron/debt-reminders, since this is also called by the scheduler,
 * not a signed-in browser.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await prisma.company.findMany({ where: { status: { not: "SUSPENDED" } }, select: { id: true } });

  const results: { companyId: string; escalated: number }[] = [];

  for (const company of companies) {
    const db = getScopedPrisma(company.id);

    const escalated = await db.$transaction(async (tx) => {
      const flags = await escalateOverdueFlags(tx, company.id);
      if (flags.length === 0) return flags;

      // Escalation notifies Branch Manager + Owner — distinct from the
      // wider set of roles who gain resolve rights once escalated (see
      // sale-flag-service.ts's resolveSaleFlag).
      const reviewers = await tx.membership.findMany({
        where: { status: "ACTIVE", role: { isSystem: true, name: { in: ["Owner", "Branch Manager"] } } },
        select: { id: true },
      });
      const reviewerIds = reviewers.map((r) => r.id);

      for (const flag of flags) {
        const sale = await tx.sale.findUnique({ where: { id: flag.saleId }, select: { saleNumber: true } });
        await createNotifications(tx, company.id, reviewerIds, {
          type: "SALE_FLAG_ESCALATED",
          title: `Flagged sale ${sale?.saleNumber ?? ""} missed its deadline`,
          body: "The submitter didn't correct and resubmit this sale by midnight — it now needs a Branch Manager, Admin, or Cashier to resolve it.",
          entityType: "Sale",
          entityId: flag.saleId,
        });
      }

      return flags;
    });

    if (escalated.length > 0) {
      results.push({ companyId: company.id, escalated: escalated.length });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), companiesProcessed: companies.length, results });
}
