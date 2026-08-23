import { z } from "zod";
import { emptyToUndefined } from "./shared";

export const purchaseOrderLineItemSchema = z.object({
  productId: z.string().min(1),
  quantityOrdered: z.coerce.number().int().positive("Quantity must be greater than 0"),
  unitCost: z.coerce.number().nonnegative("Unit cost cannot be negative"),
});

export const createPurchaseOrderSchema = z
  .object({
    supplierId: z.string().min(1, "Select a supplier"),
    destinationType: z.enum(["WAREHOUSE", "BRANCH"]),
    destinationWarehouseId: z.preprocess(emptyToUndefined, z.string().optional()),
    destinationBranchId: z.preprocess(emptyToUndefined, z.string().optional()),
    expectedDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
    lineItems: z.array(purchaseOrderLineItemSchema).min(1, "Add at least one product"),
  })
  .refine((data) => (data.destinationType === "WAREHOUSE" ? Boolean(data.destinationWarehouseId) : Boolean(data.destinationBranchId)), {
    message: "Select a destination location",
    path: ["destinationWarehouseId"],
  });
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const receivePurchaseOrderLineItemSchema = z.object({
  quantityReceived: z.coerce.number().int().positive("Received quantity must be greater than 0"),
  // Only needed when the product tracks batches — enforced in the service
  // layer (BatchRequiredError), not here, since that check needs to read
  // Product.tracksBatches from the DB.
  batchNumber: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  expiryDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  manufactureDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});
export type ReceivePurchaseOrderLineItemInput = z.infer<typeof receivePurchaseOrderLineItemSchema>;
