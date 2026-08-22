import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import * as paystack from "@/lib/paystack/client";
import { getCreditedTotal } from "@/server/services/credit-note-service";
import * as saleService from "@/server/services/sale-service";
import { writeAuditLog } from "@/server/services/audit-service";

export class DebtorPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DebtorPaymentError";
  }
}

export type PayableSale = {
  saleId: string;
  companyId: string;
  companyName: string;
  currency: string;
  customerName: string | null;
  saleNumber: string;
  outstanding: Prisma.Decimal;
};

/** Reads with the plain (unscoped) client — there's no signed-in session/company to scope by on a public payment link; saleId already came from a signature-verified token, not user input. */
export async function getPayableSale(saleId: string): Promise<PayableSale | null> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { company: { select: { id: true, name: true, currency: true } }, customer: { select: { name: true } } },
  });
  if (!sale || sale.status === "VOIDED") return null;

  // Inlined rather than reusing credit-note-service's getCreditedTotal():
  // that helper is typed against the tenant-scoped client shape, and there
  // is no signed-in company to scope by on a public payment link — this
  // is the same aggregate query, just against the plain client.
  const creditedResult = await prisma.creditNote.aggregate({ where: { saleId, status: "ISSUED" }, _sum: { amount: true } });
  const credited = creditedResult._sum.amount ?? new Prisma.Decimal(0);
  const outstanding = sale.grandTotal.sub(sale.amountPaid).sub(credited);

  return {
    saleId: sale.id,
    companyId: sale.company.id,
    companyName: sale.company.name,
    currency: sale.company.currency,
    customerName: sale.customer?.name ?? null,
    saleNumber: sale.saleNumber,
    outstanding,
  };
}

function paymentModeFromChannel(channel: string | undefined): "CASH" | "CARD" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER" {
  switch (channel) {
    case "card":
      return "CARD";
    case "bank":
    case "bank_transfer":
      return "BANK_TRANSFER";
    case "mobile_money":
    case "ussd":
      return "MOBILE_MONEY";
    default:
      return "OTHER";
  }
}

export async function startDebtorPayment(saleId: string, baseUrl: string) {
  const payable = await getPayableSale(saleId);
  if (!payable) throw new DebtorPaymentError("This payment link could not be found.");
  if (payable.outstanding.lte(0)) {
    throw new DebtorPaymentError("This balance has already been settled — nothing left to pay.");
  }

  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { customer: { select: { email: true } } } });
  const email = sale?.customer?.email || `customer-${saleId}@payer.invalid`;

  const reference = `debtorpay_${saleId}_${Date.now()}`;

  return paystack.initializeTransaction({
    email,
    amountKobo: Math.round(Number(payable.outstanding) * 100),
    callbackUrl: `${baseUrl}/pay/${encodeURIComponent(saleId)}/callback`,
    reference,
    metadata: { purpose: "debtor_payment", saleId, companyId: payable.companyId },
  });
}

/**
 * Verifies a Paystack transaction and records the payment exactly once —
 * called from both the redirect callback page and the shared webhook,
 * same idempotency reasoning as reminder-credits-service.ts's confirm
 * function. `reference` isn't a unique DB column here, so the guard is an
 * explicit existence check rather than a unique-constraint race.
 */
export async function confirmDebtorPayment(
  reference: string,
  expectedSaleId: string | null,
): Promise<{ amount: Prisma.Decimal; alreadyProcessed: boolean; raceSettledElsewhere: boolean }> {
  const verified = await paystack.verifyTransaction(reference);
  if (verified.status !== "success") {
    throw new DebtorPaymentError(`Payment was not completed (status: ${verified.status}).`);
  }

  const purpose = verified.metadata.purpose as string | undefined;
  const saleId = verified.metadata.saleId as string | undefined;
  const companyId = verified.metadata.companyId as string | undefined;
  if (purpose !== "debtor_payment" || !saleId || !companyId) {
    throw new DebtorPaymentError("This transaction is missing the payment metadata Paystack should have echoed back.");
  }
  if (expectedSaleId && saleId !== expectedSaleId) {
    throw new DebtorPaymentError("This transaction does not match this payment link.");
  }

  const existing = await prisma.payment.findFirst({ where: { saleId, reference } });
  if (existing) {
    return { amount: existing.amount, alreadyProcessed: true, raceSettledElsewhere: false };
  }

  const amount = new Prisma.Decimal(verified.amountKobo).div(100);
  const mode = paymentModeFromChannel(verified.channel);
  const db = getScopedPrisma(companyId);

  let recordedAmount = amount;
  let raceSettledElsewhere = false;

  await db.$transaction(async (tx) => {
    const race = await tx.payment.findFirst({ where: { saleId, reference } });
    if (race) {
      recordedAmount = race.amount;
      return;
    }

    const sale = await tx.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new DebtorPaymentError("Sale not found.");

    const credited = await getCreditedTotal(tx, saleId);
    const currentOutstanding = sale.grandTotal.sub(sale.amountPaid).sub(credited);

    if (currentOutstanding.lte(0)) {
      // Someone else (a staff member recording a payment directly) settled
      // this sale in the moments between checkout starting and this
      // confirmation — the money was still genuinely collected via
      // Paystack, so it's flagged here for the Owner to reconcile rather
      // than silently discarded or forced onto a sale that can't take it
      // without violating amountPaid <= grandTotal.
      raceSettledElsewhere = true;
      await writeAuditLog(tx, {
        companyId,
        actorMembershipId: null,
        action: "sale.debtor_payment_race",
        entityType: "Sale",
        entityId: saleId,
        metadata: { amount: amount.toString(), reference, note: "Collected via pay-link after the sale was already settled elsewhere." },
      });
      return;
    }

    const payAmount = Prisma.Decimal.min(amount, currentOutstanding);
    const { payment } = await saleService.recordPayment(tx, companyId, null, {
      saleId,
      amount: payAmount,
      mode,
      reference,
      notes: "Paid via self-service debtor payment link",
    });
    recordedAmount = payment.amount;

    await writeAuditLog(tx, {
      companyId,
      actorMembershipId: null,
      action: "sale.debtor_payment_recorded",
      entityType: "Sale",
      entityId: saleId,
      metadata: { amount: payment.amount.toString(), reference, source: "debtor_pay_link" },
    });
  });

  return { amount: recordedAmount, alreadyProcessed: false, raceSettledElsewhere };
}
