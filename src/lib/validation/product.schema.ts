import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(64, "SKU must be 64 characters or fewer")
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may only contain letters, numbers, dots, dashes, and underscores"),
  barcode: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  unitLabel: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  unitPrice: z.coerce.number().positive("Price must be greater than 0").max(1_000_000_000),
  costPrice: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(1_000_000_000).optional()),
  reorderPoint: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  tracksBatches: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
});

export type ProductInput = z.infer<typeof productSchema>;
