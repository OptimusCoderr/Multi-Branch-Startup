import { z } from "zod";
import { emptyToUndefined } from "./shared";

// Deliberately NOT a .refine() requiring phone-when-remindersEnabled here —
// this schema is shared with the mobile create/update API routes, which
// never surface remindersEnabled as a concept at all (it silently
// defaults true) and often create a customer with no phone. The web
// customer-management actions (customers.ts) enforce that requirement
// themselves, on top of this base schema, since it's a web-only UI
// decision, not a shape the data itself must always satisfy.
export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  creditLimit: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(1_000_000_000).optional()),
  remindersEnabled: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
  // Which DebtReminderTemplate this customer's automated reminders use —
  // see the schema comment on Customer.reminderTemplateId. Blank means
  // "use the company default."
  reminderTemplateId: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type CustomerInput = z.infer<typeof customerSchema>;
