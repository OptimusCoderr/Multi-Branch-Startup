import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { decrementBranchStock, incrementBranchStock, recordStockMovement, type ConsumedBatch } from "@/server/services/inventory-service";
import { getCreditedTotal } from "@/server/services/credit-note-service";
import { assertNoOpenReportBlockingSale } from "@/server/services/sales-report-service";

type ScopedTx = Pick<
  ReturnType<typeof getScopedPrisma>,
  | "product"
  | "sale"
  | "saleLineItem"
  | "payment"
  | "company"
  | "branchStock"
  | "warehouseStock"
  | "warehouse"
  | "branch"
  | "stockMovement"
  | "customer"
  | "productBatch"
  | "creditNote"
  | "membership"
  | "dailySalesReport"
  | "notification"
>;

export class SaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleValidationError";
  }
}

export class SaleNotFoundError extends Error {
  constructor() {
    super("Sale not found.");
    this.name = "SaleNotFoundError";
  }
}

async function getSaleOrThrow(tx: ScopedTx, saleId: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw new SaleNotFoundError();
  return sale;
}

/** "Walk-in Customer #001", "#002", ... — same atomic-counter pattern as saleNumber below. */
async function generateWalkInCustomerName(tx: ScopedTx, companyId: string): Promise<string> {
  const company = await tx.company.update({
    where: { id: companyId },
    data: { walkInCounter: { increment: 1 } },
  });
  return `Walk-in Customer #${String(company.walkInCounter).padStart(3, "0")}`;
}

/**
 * Creates a Sale with server-computed totals (never trust a client-sent
 * total), snapshotting each line item's price so a later edit to
 * Product.unitPrice can never rewrite a historical invoice. Stock is
 * decremented per line item through the same atomic, oversell-safe guard
 * used by transfers — two concurrent sales racing for the last units can't
 * both succeed.
 */
export async function createSale(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  input: {
    branchId: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    dueDate?: Date;
    // A line item is either a catalog product (productId + quantity) or an
    // ad-hoc service (no productId — a free-text description + a manually
    // typed price instead, no catalog record required). Which one it is is
    // determined purely by whether productId is present; a client can't
    // send a mismatched combination.
    lineItems: { productId?: string; quantity: number; description?: string; unitPrice?: number }[];
    /** True for Owner/Admin recorders — they're exempt from the end-of-day report lock. See sales-report-service.ts. */
    isReportExempt?: boolean;
    /** Set only by the mobile app's offline sync queue, for idempotent retries — see Sale.clientRequestId's schema comment. */
    clientRequestId?: string;
    /**
     * Web-only for now — the payment-type buttons on the sale form. Drives
     * the customer-name/phone defaulting rules above; the actual Payment
     * row(s) are created by the caller (see actions/sales.ts) via the
     * existing recordPayment(), once the grandTotal this function computes
     * is known.
     */
    paymentType?: "POS" | "CASH" | "POS_CASH" | "PART_PAYMENT";
  },
) {
  if (input.lineItems.length === 0) {
    throw new SaleValidationError("A sale needs at least one line item.");
  }

  // Idempotent replay: the offline mobile queue may retry a sync request
  // whose server-side write actually succeeded but whose response the
  // phone never received (dropped connection). Returning the existing sale
  // here — before any stock is touched — means a retry can never
  // double-create a sale or double-decrement stock.
  if (input.clientRequestId) {
    const existing = await tx.sale.findUnique({ where: { companyId_clientRequestId: { companyId, clientRequestId: input.clientRequestId } } });
    if (existing) return existing;
  }

  if (!input.isReportExempt) {
    await assertNoOpenReportBlockingSale(tx, companyId, membershipId, input.branchId);
  }

  // When an existing customer is selected, their contact details are
  // snapshotted onto the Sale (same philosophy as line-item price
  // snapshotting) so the invoice's displayed contact info never silently
  // changes if the Customer record is edited later — but the sale still
  // stays linked via customerId for live balance aggregation.
  let customerName = input.customerName;
  let customerPhone = input.customerPhone;
  let customerEmail = input.customerEmail;

  const isPartPayment = input.paymentType === "PART_PAYMENT";

  if (input.customerId) {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer || !customer.isActive) {
      throw new SaleValidationError("Selected customer is unavailable.");
    }
    customerName = customer.name;
    customerPhone = customer.phone ?? undefined;
    customerEmail = customer.email ?? undefined;
  } else if (isPartPayment) {
    // A part payment leaves a balance to chase later — the web form
    // requires a name and phone up front rather than falling back to
    // anything auto-generated, same rationale as the debt-reminder
    // phone-required rule elsewhere in this app.
    if (!customerName?.trim()) {
      throw new SaleValidationError("Customer name is required for a part payment.");
    }
    if (!customerPhone?.trim()) {
      throw new SaleValidationError("Customer phone is required for a part payment.");
    }
  } else if (!customerName?.trim()) {
    if (input.paymentType) {
      // A fully-paid walk-in (POS/CASH/POS+CASH) with no name given — auto
      // -number it rather than attributing it to the staff member, so the
      // invoice reads the way a POS receipt actually would.
      customerName = await generateWalkInCustomerName(tx, companyId);
    } else {
      // No payment type at all (e.g. the mobile app, which doesn't collect
      // one) — default to the staff member recording the sale instead, so
      // a sale is never left with no one attached to it.
      const recorder = await tx.membership.findUnique({ where: { id: membershipId }, include: { user: true } });
      customerName = recorder?.displayName ?? recorder?.user.name ?? undefined;
    }
  }

  const productIds = [...new Set(input.lineItems.filter((li) => li.productId).map((li) => li.productId as string))];
  const products = await tx.product.findMany({ where: { id: { in: productIds }, isActive: true } });
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = new Prisma.Decimal(0);
  const lineItemsData: {
    productId: string | null;
    isService: boolean;
    description: string | null;
    quantity: number;
    unitPriceAtSale: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[] = [];

  for (const li of input.lineItems) {
    if (li.productId) {
      const product = productById.get(li.productId);
      if (!product) {
        throw new SaleValidationError("One of the selected products is unavailable.");
      }
      const lineTotal = product.unitPrice.mul(li.quantity);
      subtotal = subtotal.add(lineTotal);
      lineItemsData.push({
        productId: li.productId,
        isService: false,
        description: null,
        quantity: li.quantity,
        unitPriceAtSale: product.unitPrice,
        lineTotal,
      });
    } else {
      // Ad-hoc service — no catalog record, so nothing to validate against
      // except that the staff actually typed a description and a price.
      if (!li.description?.trim()) {
        throw new SaleValidationError("Every service line item needs a description.");
      }
      if (li.unitPrice === undefined || li.unitPrice <= 0) {
        throw new SaleValidationError("Every service line item needs a price greater than 0.");
      }
      const quantity = li.quantity > 0 ? li.quantity : 1;
      const unitPriceAtSale = new Prisma.Decimal(li.unitPrice);
      const lineTotal = unitPriceAtSale.mul(quantity);
      subtotal = subtotal.add(lineTotal);
      lineItemsData.push({
        productId: null,
        isService: true,
        description: li.description.trim(),
        quantity,
        unitPriceAtSale,
        lineTotal,
      });
    }
  }

  const grandTotal = subtotal;

  // Atomically allocate the next sequential sale number for this company —
  // the row-level lock on the UPDATE serializes concurrent sale creations,
  // so two sales can never be assigned the same number.
  const company = await tx.company.update({
    where: { id: companyId },
    data: { saleCounter: { increment: 1 } },
  });
  const saleNumber = `INV-${String(company.saleCounter).padStart(6, "0")}`;

  const sale = await tx.sale.create({
    data: {
      companyId,
      branchId: input.branchId,
      saleNumber,
      customerId: input.customerId ?? null,
      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      customerEmail: customerEmail ?? null,
      dueDate: input.dueDate ?? null,
      status: "CONFIRMED",
      subtotal,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal,
      amountPaid: 0,
      soldByMembershipId: membershipId,
      clientRequestId: input.clientRequestId ?? null,
    },
  });

  for (const li of lineItemsData) {
    // An ad-hoc service line has no catalog record and never had any
    // stock provisioned for it — skip every stock-related step entirely.
    // Still a perfectly normal, fully-priced sale line item otherwise.

    // Throws InsufficientStockError if the branch doesn't have enough —
    // the whole transaction (including the Sale row already created above)
    // rolls back, so a failed sale never partially commits. Runs before
    // the line item is created so the exact batch(es) consumed can be
    // recorded on it in one write — voidSale() reverses precisely this.
    const consumedBatches: ConsumedBatch[] = li.isService
      ? []
      : await decrementBranchStock(tx, companyId, li.productId as string, input.branchId, li.quantity);

    await tx.saleLineItem.create({
      data: {
        saleId: sale.id,
        productId: li.productId,
        isService: li.isService,
        adHocDescription: li.description,
        quantity: li.quantity,
        unitPriceAtSale: li.unitPriceAtSale,
        discountAmount: 0,
        lineTotal: li.lineTotal,
        batchConsumption: consumedBatches.length > 0 ? (consumedBatches as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    if (!li.isService) {
      await recordStockMovement(tx, {
        companyId,
        productId: li.productId as string,
        locationType: "BRANCH",
        branchId: input.branchId,
        quantityDelta: -li.quantity,
        reason: "SALE",
        referenceType: "Sale",
        referenceId: sale.id,
        performedByMembershipId: membershipId,
      });
    }
  }

  return sale;
}

/**
 * Appends a Payment row (the installment ledger for a Sale) and
 * transitions status CONFIRMED -> PARTIALLY_PAID -> PAID. The caller must
 * run this inside a SERIALIZABLE transaction — the read-then-write here
 * (read amountPaid, decide the new status, write it back) is not a single
 * atomic UPDATE the way stock decrements are, since it also depends on the
 * sale's grandTotal, so Postgres's serializable isolation is what prevents
 * two concurrent payments from both reading a stale amountPaid and jointly
 * overpaying the sale.
 */
export async function recordPayment(
  tx: ScopedTx,
  companyId: string,
  // Null only for a debtor's own self-serve payment link (no staff
  // member involved) — see payment-link.ts.
  membershipId: string | null,
  input: { saleId: string; amount: Prisma.Decimal; mode: string; reference?: string; notes?: string },
) {
  const sale = await getSaleOrThrow(tx, input.saleId);

  if (sale.status === "VOIDED") {
    throw new SaleValidationError("Cannot record a payment against a voided sale.");
  }
  if (sale.status === "PAID") {
    throw new SaleValidationError("This sale is already fully paid.");
  }
  if (input.amount.lte(0)) {
    throw new SaleValidationError("Payment amount must be greater than 0.");
  }

  const alreadyCredited = await getCreditedTotal(tx, input.saleId);
  const outstanding = sale.grandTotal.sub(sale.amountPaid).sub(alreadyCredited);
  if (input.amount.gt(outstanding)) {
    throw new SaleValidationError(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`);
  }

  const payment = await tx.payment.create({
    data: {
      companyId,
      saleId: input.saleId,
      amount: input.amount,
      mode: input.mode as Prisma.PaymentCreateInput["mode"],
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      recordedByMembershipId: membershipId,
    },
  });

  const newAmountPaid = sale.amountPaid.add(input.amount);
  const newStatus = newAmountPaid.gte(sale.grandTotal) ? "PAID" : "PARTIALLY_PAID";

  const updatedSale = await tx.sale.update({
    where: { id: input.saleId },
    data: { amountPaid: newAmountPaid, status: newStatus },
  });

  return { payment, sale: updatedSale };
}

/**
 * Voids a sale and reverses its inventory impact via compensating
 * StockMovement entries — the original Sale/SaleLineItem/Payment rows are
 * never deleted, so the audit trail survives. Blocked once any payment has
 * been recorded: voiding only ever reverses inventory, never touches
 * Payment rows or amountPaid, so voiding a paid sale would make money the
 * customer already handed over vanish from every balance/report view with
 * no record prompting a refund. Use a credit note to adjust what's owed
 * instead — this app has no cash-refund ledger, so an actual refund has to
 * be handled outside it.
 */
export async function voidSale(tx: ScopedTx, companyId: string, membershipId: string, saleId: string, reason: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lineItems: true } });
  if (!sale) throw new SaleNotFoundError();
  if (sale.status === "VOIDED") {
    throw new SaleValidationError("This sale is already voided.");
  }
  if (sale.amountPaid.gt(0)) {
    throw new SaleValidationError(
      "This sale already has a payment recorded and can't be voided — issue a credit note instead, or reverse the payment outside the system.",
    );
  }

  for (const li of sale.lineItems) {
    // An ad-hoc service line item never touched stock when the sale was
    // created — see createSale() — so there's nothing to reverse here.
    if (li.isService || !li.productId) continue;

    await incrementBranchStock(tx, li.productId, sale.branchId, li.quantity);
    await recordStockMovement(tx, {
      companyId,
      productId: li.productId,
      locationType: "BRANCH",
      branchId: sale.branchId,
      quantityDelta: li.quantity,
      reason: "SALE_VOID_RESTOCK",
      referenceType: "Sale",
      referenceId: sale.id,
      performedByMembershipId: membershipId,
    });

    // Restore exactly the batch(es) this line item's sale FEFO-consumed —
    // targeting the recorded batchId directly (not re-deriving FEFO order)
    // means this is correct even if other sales/deliveries have touched
    // this product's batches at this branch since.
    const consumption = li.batchConsumption as { batchId: string; quantity: number }[] | null;
    if (consumption) {
      for (const c of consumption) {
        await tx.productBatch.updateMany({
          where: { id: c.batchId },
          data: { quantityRemaining: { increment: c.quantity } },
        });
      }
    }
  }

  return tx.sale.update({
    where: { id: saleId },
    data: { status: "VOIDED", voidedByMembershipId: membershipId, voidedAt: new Date(), voidReason: reason },
  });
}
