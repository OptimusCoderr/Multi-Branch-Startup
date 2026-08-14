import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const saleLineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
});

export const createSaleSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  customerName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  customerPhone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  customerEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
  lineItems: z.array(saleLineItemSchema).min(1, "Add at least one product"),
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
