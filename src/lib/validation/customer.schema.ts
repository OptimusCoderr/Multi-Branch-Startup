import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  creditLimit: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(1_000_000_000).optional()),
});

export type CustomerInput = z.infer<typeof customerSchema>;
