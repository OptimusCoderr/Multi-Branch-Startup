"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Checkbox, FormError, Button } from "@/components/ui";

type ProductFormState = { error: string };
const initialState: ProductFormState = { error: "" };

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
    unitPrice: string;
    costPrice: string | null;
    reorderPoint: string | null;
    tracksBatches: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
