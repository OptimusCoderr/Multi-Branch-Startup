import { z } from "zod";
import { emptyToUndefined } from "./shared";

// No `sku` field — it's auto-generated server-side (see src/lib/sku.ts) at
// creation and never editable afterward, not a client-supplied value.
export const productSchema = z.object({
  barcode: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  category: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  unitLabel: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  unitPrice: z.coerce.number().positive("Price must be greater than 0").max(1_000_000_000),
  costPrice: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(1_000_000_000).optional()),
  reorderPoint: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  tracksBatches: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
});

export type ProductInput = z.infer<typeof productSchema>;
