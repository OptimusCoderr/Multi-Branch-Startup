import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const adjustWarehouseStockSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  warehouseId: z.string().min(1, "Select a warehouse"),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero adjustment"),
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
export type AdjustWarehouseStockInput = z.infer<typeof adjustWarehouseStockSchema>;
