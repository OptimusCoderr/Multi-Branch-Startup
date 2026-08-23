"use client";

import { useActionState, useEffect } from "react";
import { Field, Input, Textarea, Checkbox, FormError, Button } from "@/components/ui";

type ProductFormState = { error: string; success?: boolean };
const initialState: ProductFormState = { error: "" };

export function ProductForm({
  action,
  defaultValues,
  submitLabel,
  categorySuggestions,
  onSuccess,
}: {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  defaultValues?: {
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    category: string | null;
    unitLabel: string;
    unitPrice: string;
    costPrice: string | null;
    reorderPoint: string | null;
    tracksBatches: boolean;
  };
  submitLabel: string;
  /** Distinct categories already in use, offered as a datalist so entries stay consistent instead of drifting into near-duplicates. */
  categorySuggestions?: string[];
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {defaultValues ? (
        <Field label="SKU" hint="Generated automatically at creation — not editable.">
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">{defaultValues.sku}</p>
        </Field>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          SKU is generated automatically from the product name once you save.
        </p>
      )}

      <Field label="Barcode" optional hint="Scanned in the mobile app for POS-speed sales entry and stock counts.">
        <Input name="barcode" mono defaultValue={defaultValues?.barcode ?? ""} placeholder="e.g. EAN-13 / UPC printed on the product" />
      </Field>

      <Field label="Name">
        <Input name="name" defaultValue={defaultValues?.name} required />
      </Field>

      <Field label="Description">
        <Textarea name="description" defaultValue={defaultValues?.description ?? ""} rows={3} />
      </Field>

      <Field label="Category" optional hint="Groups this product under a chip on the products list — free text, e.g. Beverages, Snacks.">
        <Input name="category" list="product-category-suggestions" defaultValue={defaultValues?.category ?? ""} />
        {categorySuggestions && categorySuggestions.length > 0 && (
          <datalist id="product-category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
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

      <Field
        label="Reorder point"
        optional
        hint="Get a low-stock alert once total stock across all locations falls to or below this number. Leave blank for no alert."
      >
        <Input name="reorderPoint" type="number" min="0" step="1" defaultValue={defaultValues?.reorderPoint ?? ""} />
      </Field>

      <Checkbox
        name="tracksBatches"
        defaultChecked={defaultValues?.tracksBatches ?? false}
        label="Perishable / tracked by batch"
        description="e.g. yogurt, packaged juices. Every delivery of this product will require a batch number and expiry date, and older batches are sold first."
      />

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
