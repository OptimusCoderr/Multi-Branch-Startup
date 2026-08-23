"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Field, Input, Textarea, Checkbox, FormError, Button } from "@/components/ui";

type ProductFormState = { error: string };
const initialState: ProductFormState = { error: "" };
type ProductType = "GOODS" | "SERVICE";

export function ProductForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  defaultValues?: {
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    unitLabel: string;
    unitPrice: string;
    costPrice: string | null;
    reorderPoint: string | null;
    tracksBatches: boolean;
    productType: ProductType;
  };
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  // Only editable at creation — flipping it afterward would leave a GOODS
  // product's existing stock rows stranded, or a SERVICE product with none
  // to provision retroactively. See products.ts's updateProduct, which
  // doesn't accept this field at all.
  const [productType, setProductType] = useState<ProductType>(defaultValues?.productType ?? "GOODS");
  const isService = productType === "SERVICE";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">Type</span>
        {defaultValues ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">{isService ? "Service" : "Goods (stock-tracked)"}</p>
        ) : (
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="productType"
                value="GOODS"
                checked={productType === "GOODS"}
                onChange={() => setProductType("GOODS")}
              />
              Goods (stock-tracked)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="productType"
                value="SERVICE"
                checked={productType === "SERVICE"}
                onChange={() => setProductType("SERVICE")}
              />
              Service
            </label>
          </div>
        )}
        {isService && <span className="text-xs text-gray-400 dark:text-gray-500">Services have no physical stock to track.</span>}
      </div>

      <Field label="SKU">
        <Input name="sku" mono defaultValue={defaultValues?.sku} required />
      </Field>

      <Field label="Barcode" optional hint="Scanned in the mobile app for POS-speed sales entry and stock counts.">
        <Input name="barcode" mono defaultValue={defaultValues?.barcode ?? ""} placeholder="e.g. EAN-13 / UPC printed on the product" />
      </Field>

      <Field label="Name">
        <Input name="name" defaultValue={defaultValues?.name} required />
      </Field>

      <Field label="Description">
        <Textarea name="description" defaultValue={defaultValues?.description ?? ""} rows={3} />
      </Field>

      <Field label="Unit" optional hint="How you actually sell it — e.g. carton, bag, dozen, yard, mudu. Defaults to “unit”.">
        <Input name="unitLabel" defaultValue={defaultValues?.unitLabel ?? ""} placeholder="unit" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price">
          <Input name="unitPrice" type="number" step="0.01" min="0" defaultValue={defaultValues?.unitPrice} required />
        </Field>

        <Field label="Cost price" optional>
          <Input name="costPrice" type="number" step="0.01" min="0" defaultValue={defaultValues?.costPrice ?? ""} />
        </Field>
      </div>

      {!isService && (
        <Field
          label="Reorder point"
          optional
          hint="Get a low-stock alert once total stock across all locations falls to or below this number. Leave blank for no alert."
        >
          <Input name="reorderPoint" type="number" min="0" step="1" defaultValue={defaultValues?.reorderPoint ?? ""} />
        </Field>
      )}

      {!isService && (
        <Checkbox
          name="tracksBatches"
          defaultChecked={defaultValues?.tracksBatches ?? false}
          label="Perishable / tracked by batch"
          description="e.g. yogurt, packaged juices. Every delivery of this product will require a batch number and expiry date, and older batches are sold first."
        />
      )}

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
