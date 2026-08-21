import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "sale" | "creditNote" | "company">;

export class CreditNoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditNoteValidationError";
  }
}

export class CreditNoteNotFoundError extends Error {
  constructor() {
    super("Credit note not found.");
    this.name = "CreditNoteNotFoundError";
  }
}

/** Sum of ISSUED (non-voided) credit notes against a sale. */
export async function getCreditedTotal(tx: ScopedTx, saleId: string): Promise<Prisma.Decimal> {
  const result = await tx.creditNote.aggregate({
    where: { saleId, status: "ISSUED" },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

/**
 * A credit note reduces what a customer owes on a sale without voiding
 * the sale itself or touching stock — a financial correction, not an
 * inventory event. Capped at the sale's currently outstanding balance
 * (grandTotal - amountPaid - already-credited), the same overcorrection
 * guard recordPayment() applies in the opposite direction. The caller must
 * run this inside a SERIALIZABLE transaction for the same reason
 * recordPayment() does — the read-then-write of alreadyCredited here isn't
 * a single atomic UPDATE, so two concurrent credit notes could otherwise
 * both read a stale total and jointly over-credit the sale.
 */
export async function issueCreditNote(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: { saleId: string; amount: Prisma.Decimal; reason: string },
) {
  const sale = await tx.sale.findUnique({ where: { id: input.saleId } });
  if (!sale) throw new CreditNoteValidationError("Sale not found.");
  if (sale.status === "VOIDED") {
    throw new CreditNoteValidationError("Cannot issue a credit note against a voided sale.");
  }
  if (input.amount.lte(0)) {
    throw new CreditNoteValidationError("Credit note amount must be greater than 0.");
  }

  const alreadyCredited = await getCreditedTotal(tx, input.saleId);
  const outstanding = sale.grandTotal.sub(sale.amountPaid).sub(alreadyCredited);
  if (input.amount.gt(outstanding)) {
    throw new CreditNoteValidationError(`Credit note exceeds the outstanding balance of ${outstanding.toFixed(2)}.`);
  }

  // Atomically allocate the next sequential credit note number — same
  // row-lock-via-UPDATE pattern as Sale.saleNumber, so two concurrent
  // credit notes can never collide.
  const company = await tx.company.update({
    where: { id: companyId },
    data: { creditNoteCounter: { increment: 1 } },
  });
  const creditNoteNumber = `CN-${String(company.creditNoteCounter).padStart(6, "0")}`;

  return tx.creditNote.create({
    data: {
      companyId,
      saleId: input.saleId,
      creditNoteNumber,
      amount: input.amount,
      reason: input.reason,
      status: "ISSUED",
      issuedByMembershipId: membershipId,
    },
  });
}

export async function voidCreditNote(tx: ScopedTx, membershipId: string, creditNoteId: string, reason: string) {
  const creditNote = await tx.creditNote.findUnique({ where: { id: creditNoteId } });
  if (!creditNote) throw new CreditNoteNotFoundError();
  if (creditNote.status === "VOIDED") {
    throw new CreditNoteValidationError("This credit note is already voided.");
  }

  return tx.creditNote.update({
    where: { id: creditNoteId },
    data: { status: "VOIDED", voidedByMembershipId: membershipId, voidedAt: new Date(), voidReason: reason },
  });
}
