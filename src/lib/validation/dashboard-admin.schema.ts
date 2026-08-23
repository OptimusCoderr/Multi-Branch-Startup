import { z } from "zod";

/** The "type RESET to confirm" daily-sales-wipe tool on the dashboard. */
export const resetSalesDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  confirmText: z.literal("RESET", { message: 'Type "RESET" exactly to confirm' }),
});
export type ResetSalesDayInput = z.infer<typeof resetSalesDaySchema>;
