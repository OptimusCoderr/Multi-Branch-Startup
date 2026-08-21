import { z } from "zod";
import { emptyToUndefined } from "./shared";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

// Both optional — a business that isn't (yet) CAC-registered can still sign
// up and operate (see the verification flow, src/server/actions/verification.ts);
// these just get the process started when the info is on hand already.
export const createCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
  rcNumber: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  incorporationDate: z.preprocess(emptyToUndefined, z.coerce.date().max(new Date(), "Incorporation date can't be in the future").optional()),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export { slugify };

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Your name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
});
