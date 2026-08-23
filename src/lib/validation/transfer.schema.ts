import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const requestTransferSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  destinationBranchId: z.string().min(1, "Select a destination branch"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});
export type RequestTransferInput = z.infer<typeof requestTransferSchema>;

// The reviewer's source pick at approval time — not the requester's, who
// no longer chooses one (see requestTransferSchema above).
export const resolveTransferSchema = z
  .object({
    sourceType: z.enum(["WAREHOUSE", "BRANCH", "EXTERNAL"]),
    sourceWarehouseId: z.preprocess(emptyToUndefined, z.string().optional()),
    sourceBranchId: z.preprocess(emptyToUndefined, z.string().optional()),
    externalSourceName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    // Only needed when the product tracks batches and the source is
    // EXTERNAL — enforced in the service layer (BatchRequiredError), not
    // here, since that check needs to read Product.tracksBatches.
    batchNumber: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
    expiryDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    manufactureDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  })
  .refine(
    (data) => {
      if (data.sourceType === "WAREHOUSE") return Boolean(data.sourceWarehouseId);
      if (data.sourceType === "BRANCH") return Boolean(data.sourceBranchId);
      return Boolean(data.externalSourceName);
    },
    { message: "Select or enter a source", path: ["sourceType"] },
  );
export type ResolveTransferInput = z.infer<typeof resolveTransferSchema>;

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
