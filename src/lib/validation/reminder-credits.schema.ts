import { z } from "zod";

// Kept in sync by hand with CREDIT_PACKS in reminder-credits-service.ts —
// validation schemas don't import from the service layer in this codebase,
// so this is a literal list rather than a derived one.
export const startCreditPurchaseSchema = z.object({
  packId: z.enum(["pack_50", "pack_200", "pack_500"]),
});
export type StartCreditPurchaseInput = z.infer<typeof startCreditPurchaseSchema>;
