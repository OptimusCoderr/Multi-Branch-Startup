import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const submitCacVerificationSchema = z.object({
  rcNumber: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  incorporationDate: z.preprocess(
    emptyToUndefined,
    z.coerce.date().max(new Date(), "Incorporation date can't be in the future").optional(),
  ),
  cacCertificateUrl: z.string().trim().url("Enter a valid link to your certificate"),
});
export type SubmitCacVerificationInput = z.infer<typeof submitCacVerificationSchema>;
