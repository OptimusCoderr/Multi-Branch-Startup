import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const requestTransferSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  sourceWarehouseId: z.string().min(1, "Select a source warehouse"),
  destinationBranchId: z.string().min(1, "Select a destination branch"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});
export type RequestTransferInput = z.infer<typeof requestTransferSchema>;

export const rejectTransferSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required").max(500),
});
export type RejectTransferInput = z.infer<typeof rejectTransferSchema>;

export const receiveTransferSchema = z.object({
  receivedQuantity: z.coerce.number().int().nonnegative("Received quantity cannot be negative"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;

export const receiveExternalSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  destinationBranchId: z.string().min(1, "Select a destination branch"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  externalSourceName: z.string().trim().min(1, "Supplier/source name is required").max(200),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});
export type ReceiveExternalInput = z.infer<typeof receiveExternalSchema>;
