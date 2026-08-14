import { z } from "zod";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const createCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export { slugify };

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Your name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
});
