import { z } from "zod";

export const debtReminderSettingsSchema = z.object({
  debtReminderEnabled: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  debtReminderDaysOverdue: z.coerce.number().int().min(1, "Must be at least 1 day").max(365),
});
export type DebtReminderSettingsInput = z.infer<typeof debtReminderSettingsSchema>;
