import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const submitCacVerificationSchema = z.object({
  rcNumber: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  // .refine() (not .max(new Date())) so "now" is evaluated at validation
  // time — .max() bakes in whatever Date the schema module happened to
  // load at, which in a long-lived server process is process-start time,
  // not "now." That would eventually reject any recent, genuinely-past
  // incorporation date once enough time passed since the last restart.
  incorporationDate: z.preprocess(
    emptyToUndefined,
    z.coerce
      .date()
      .refine((date) => date <= new Date(), "Incorporation date can't be in the future")
      .optional(),
  ),
  cacCertificateUrl: z.string().trim().url("Enter a valid link to your certificate"),
});
export type SubmitCacVerificationInput = z.infer<typeof submitCacVerificationSchema>;
