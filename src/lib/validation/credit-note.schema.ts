import { z } from "zod";

export const issueCreditNoteSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteSchema>;

export const voidCreditNoteSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type VoidCreditNoteInput = z.infer<typeof voidCreditNoteSchema>;
