import "server-only";
import { resolveBusinessDay } from "@/lib/business-day";
import { voidSale, SaleValidationError } from "@/server/services/sale-service";

export class ResetDateInFutureError extends Error {
  constructor() {
    super("Can't reset a day that hasn't happened yet.");
    this.name = "ResetDateInFutureError";
  }
}

export type ResetDayResult = { voidedCount: number; skippedPaidCount: number };

/**
 * The "type RESET to confirm" daily-sales-wipe admin tool. Deliberately
 * narrower than a literal delete: it reuses voidSale() per sale rather than
 * touching rows directly, so every one of voidSale's own safety rails still
 * applies — in particular, a sale that already has a payment recorded is
 * left untouched (skippedPaidCount), not force-voided. Force-voiding a paid
 * sale here would make cash the merchant is physically holding vanish from
 * every revenue/report view with no record prompting a refund — the exact
 * problem voidSale's own doc comment already explains, just at whole-day
 * scale instead of one sale. A day with only test/junk unpaid sales resets
 * cleanly; a day with real collected payments needs those handled via
 * credit notes individually, same as any other correction.
 */
export async function resetSalesForDay(
  tx: Parameters<typeof voidSale>[0],
  companyId: string,
  membershipId: string,
  timezone: string,
  dateKey: string,
): Promise<ResetDayResult> {
  const { startUtc, endUtc } = resolveBusinessDay(timezone, new Date(`${dateKey}T12:00:00.000Z`));
  if (startUtc > new Date()) throw new ResetDateInFutureError();

  const sales = await tx.sale.findMany({
    where: { status: { not: "VOIDED" }, createdAt: { gte: startUtc, lt: endUtc } },
    select: { id: true },
  });

  let voidedCount = 0;
  let skippedPaidCount = 0;
  for (const sale of sales) {
    try {
      await voidSale(tx, companyId, membershipId, sale.id, `Daily sales reset (${dateKey})`);
      voidedCount++;
    } catch (err) {
      if (err instanceof SaleValidationError) {
        skippedPaidCount++;
        continue;
      }
      throw err;
    }
  }

  return { voidedCount, skippedPaidCount };
}
