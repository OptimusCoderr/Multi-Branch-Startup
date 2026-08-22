import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const submitSalesReportSchema = z.object({
  branchId: z.string().min(1, "Select a branch"),
  declaredCash: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative("Declared cash can't be negative").optional()),
  staffNote: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});
export type SubmitSalesReportInput = z.infer<typeof submitSalesReportSchema>;

export const respondSalesReportSchema = z
  .object({
    action: z.enum(["APPROVE", "SEND_BACK", "REJECT"]),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  })
  .refine((data) => data.action !== "SEND_BACK" || Boolean(data.note), {
    message: "A note is required when sending a report back",
    path: ["note"],
  });
export type RespondSalesReportInput = z.infer<typeof respondSalesReportSchema>;
