import { z } from "zod";

const emptyToUndefined = (val: unknown) => (val === "" || val === null || val === undefined ? undefined : val);

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const branchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
});
export type BranchInput = z.infer<typeof branchSchema>;
