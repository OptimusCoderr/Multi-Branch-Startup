import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

export const recurrenceIntervalSchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY"]);

export const createExpenseSchema = z
  .object({
    categoryId: z.string().min(1, "Select a category"),
    branchId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000_000),
    expenseDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
    isRecurring: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
    recurrenceInterval: z.preprocess(emptyToUndefined, recurrenceIntervalSchema.optional()),
  })
  .refine((data) => !data.isRecurring || !!data.recurrenceInterval, {
    message: "Select how often this expense recurs",
    path: ["recurrenceInterval"],
  });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;
