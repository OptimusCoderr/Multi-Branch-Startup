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

export const createSaleSchema = z.object({
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
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const paymentModeSchema = z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"]);

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
