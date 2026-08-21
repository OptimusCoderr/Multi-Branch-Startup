import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { decrementBranchStock, incrementBranchStock, recordStockMovement } from "@/server/services/inventory-service";

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
    lineItems: { productId: string; quantity: number }[];
  },
) {
  if (input.lineItems.length === 0) {
    throw new SaleValidationError("A sale needs at least one line item.");
  }

  // When an existing customer is selected, their contact details are
  // snapshotted onto the Sale (same philosophy as line-item price
  // snapshotting) so the invoice's displayed contact info never silently
  // changes if the Customer record is edited later — but the sale still
  // stays linked via customerId for live balance aggregation.
  let customerName = input.customerName;
  let customerPhone = input.customerPhone;
  let customerEmail = input.customerEmail;

  if (input.customerId) {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer || !customer.isActive) {
      throw new SaleValidationError("Selected customer is unavailable.");
    }
    customerName = customer.name;
    customerPhone = customer.phone ?? undefined;
    customerEmail = customer.email ?? undefined;
  }

  const productIds = [...new Set(input.lineItems.map((li) => li.productId))];
  const products = await tx.product.findMany({ where: { id: { in: productIds }, isActive: true } });
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = new Prisma.Decimal(0);
  const lineItemsData: { productId: string; quantity: number; unitPriceAtSale: Prisma.Decimal; lineTotal: Prisma.Decimal }[] = [];

  for (const li of input.lineItems) {
    const product = productById.get(li.productId);
    if (!product) {
      throw new SaleValidationError("One of the selected products is unavailable.");
    }
    const lineTotal = product.unitPrice.mul(li.quantity);
    subtotal = subtotal.add(lineTotal);
    lineItemsData.push({ productId: li.productId, quantity: li.quantity, unitPriceAtSale: product.unitPrice, lineTotal });
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
    },
  });

  for (const li of lineItemsData) {
    await tx.saleLineItem.create({
      data: {
        saleId: sale.id,
        productId: li.productId,
        quantity: li.quantity,
        unitPriceAtSale: li.unitPriceAtSale,
        discountAmount: 0,
        lineTotal: li.lineTotal,
      },
    });

    // Throws InsufficientStockError if the branch doesn't have enough —
    // the whole transaction (including the Sale row already created above)
    // rolls back, so a failed sale never partially commits.
    await decrementBranchStock(tx, li.productId, input.branchId, li.quantity);

    await recordStockMovement(tx, {
      companyId,
      productId: li.productId,
      locationType: "BRANCH",
      branchId: input.branchId,
      quantityDelta: -li.quantity,
      reason: "SALE",
      referenceType: "Sale",
      referenceId: sale.id,
      performedByMembershipId: membershipId,
    });
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
  membershipId: string,
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

  const outstanding = sale.grandTotal.sub(sale.amountPaid);
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
 * never deleted, so the audit trail survives.
 */
export async function voidSale(tx: ScopedTx, companyId: string, membershipId: string, saleId: string, reason: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lineItems: true } });
  if (!sale) throw new SaleNotFoundError();
  if (sale.status === "VOIDED") {
    throw new SaleValidationError("This sale is already voided.");
  }

  for (const li of sale.lineItems) {
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
  }

  return tx.sale.update({
    where: { id: saleId },
    data: { status: "VOIDED", voidedByMembershipId: membershipId, voidedAt: new Date(), voidReason: reason },
  });
}
