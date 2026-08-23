import { z } from "zod";
import { emptyToUndefined } from "./shared";

// A line item is either a catalog product (productId set) or an ad-hoc
// service — a free-text description + a manually typed price, no catalog
// record required (see SaleLineItem.isService/adHocDescription's schema
// comment). Exactly one of the two shapes must be satisfied.
export const saleLineItemSchema = z
  .object({
    productId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
    unitPrice: z.preprocess(emptyToUndefined, z.coerce.number().positive().optional()),
  })
  .refine((data) => Boolean(data.productId) || (Boolean(data.description) && data.unitPrice !== undefined), {
    message: "A service line item needs both a description and a price.",
    path: ["description"],
  });

export const paymentModeSchema = z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "POS", "OTHER"]);

// The web sale form's payment-type buttons. POS/CASH/POS_CASH are "full
// payment" types — the sale is paid in full at the moment it's recorded.
// PART_PAYMENT leaves a balance outstanding, same as the pre-existing
// credit-sale/dueDate mechanism. Optional so mobile (which doesn't send
// this) and any other caller keep their existing behavior untouched.
export const paymentTypeSchema = z.enum(["POS", "CASH", "POS_CASH", "PART_PAYMENT"]);

export const createSaleSchema = z
  .object({
    branchId: z.string().min(1, "Select a branch"),
    customerId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    customerName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    customerPhone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
    customerEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
    dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    lineItems: z.array(saleLineItemSchema).min(1, "Add at least one product"),
    // Mobile-only, set by the offline sync queue for idempotent retries — the
    // web form never sends this.
    clientRequestId: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
    paymentType: z.preprocess(emptyToUndefined, paymentTypeSchema.optional()),
    // POS_CASH only — a split between the two modes, validated against the
    // server-computed grandTotal in the action once it's known.
    posAmount: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
    cashAmount: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
    // PART_PAYMENT only — how much is being paid right now (can be 0 — a
    // pure credit sale) and in what mode.
    partAmountPaid: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
    partPaymentMode: z.preprocess(emptyToUndefined, paymentModeSchema.optional()),
  })
  .refine((data) => data.paymentType !== "PART_PAYMENT" || Boolean(data.customerId) || Boolean(data.customerName?.trim()), {
    message: "Customer name is required for a part payment.",
    path: ["customerName"],
  })
  .refine((data) => data.paymentType !== "PART_PAYMENT" || Boolean(data.customerId) || Boolean(data.customerPhone?.trim()), {
    message: "Customer phone is required for a part payment.",
    path: ["customerPhone"],
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  mode: paymentModeSchema,
  reference: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const voidSaleSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
