import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const flagSaleSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type FlagSaleInput = z.infer<typeof flagSaleSchema>;

// "Edit and resubmit" is deliberately narrow — only the customer-identifying
// fields, never line items/prices (see SaleFlag's schema comment). Any
// field left blank is left untouched, not cleared — see
// sale-flag-service.ts's resolveSaleFlag.
export const resolveSaleFlagSchema = z.object({
  customerName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  customerPhone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  customerEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  note: z.string().trim().min(1, "A note explaining the correction is required").max(500),
});
export type ResolveSaleFlagInput = z.infer<typeof resolveSaleFlagSchema>;
