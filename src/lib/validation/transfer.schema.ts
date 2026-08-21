import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const requestTransferSchema = z
  .object({
    productId: z.string().min(1, "Select a product"),
    sourceType: z.enum(["WAREHOUSE", "BRANCH"]),
    sourceWarehouseId: z.preprocess(emptyToUndefined, z.string().optional()),
    sourceBranchId: z.preprocess(emptyToUndefined, z.string().optional()),
    destinationBranchId: z.string().min(1, "Select a destination branch"),
    quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  })
  .refine((data) => (data.sourceType === "WAREHOUSE" ? Boolean(data.sourceWarehouseId) : Boolean(data.sourceBranchId)), {
    message: "Select a source location",
    path: ["sourceWarehouseId"],
  })
  .refine((data) => data.sourceType !== "BRANCH" || data.sourceBranchId !== data.destinationBranchId, {
    message: "Source and destination branch must be different",
    path: ["sourceBranchId"],
  });
export type RequestTransferInput = z.infer<typeof requestTransferSchema>;

export const rejectTransferSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required").max(500),
});
export type RejectTransferInput = z.infer<typeof rejectTransferSchema>;

export const receiveTransferSchema = z.object({
  receivedQuantity: z.coerce.number().int().nonnegative("Received quantity cannot be negative"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  // Only needed when the product tracks batches AND the source location
  // (branch or warehouse — both track batches) genuinely has no matching
  // batch rows to carry over, e.g. batch tracking was turned on for the
  // product after stock already existed there. Enforced in the service
  // layer (BatchRequiredError), not here.
  batchNumber: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  expiryDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  manufactureDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;

export const receiveExternalSchema = z
  .object({
    productId: z.string().min(1, "Select a product"),
    destinationType: z.enum(["WAREHOUSE", "BRANCH"]),
    destinationWarehouseId: z.preprocess(emptyToUndefined, z.string().optional()),
    destinationBranchId: z.preprocess(emptyToUndefined, z.string().optional()),
    quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
    externalSourceName: z.string().trim().min(1, "Supplier/source name is required").max(200),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
    // Required only when the selected product tracks batches — enforced in
    // the service layer (BatchRequiredError), not here, since that check
    // needs to read Product.tracksBatches from the DB.
    batchNumber: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
    expiryDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    manufactureDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  })
  .refine((data) => (data.destinationType === "WAREHOUSE" ? Boolean(data.destinationWarehouseId) : Boolean(data.destinationBranchId)), {
    message: "Select a receiving location",
    path: ["destinationWarehouseId"],
  });
export type ReceiveExternalInput = z.infer<typeof receiveExternalSchema>;
