import { z } from "zod";

export const startCheckoutSchema = z.object({
  planId: z.string().min(1, "Select a plan").max(100),
});
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
