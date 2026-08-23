import { z } from "zod";

export const resolveLockedWaybillSchema = z.object({
  resolution: z.enum(["ACCEPT_LAST_COUNT", "REJECT_AND_REVERSE"]),
});
export type ResolveLockedWaybillInput = z.infer<typeof resolveLockedWaybillSchema>;
