import { z } from "zod";

export const debtReminderTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  message: z.string().trim().min(1, "Message is required").max(1000),
  isDefault: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
});

export type DebtReminderTemplateInput = z.infer<typeof debtReminderTemplateSchema>;
