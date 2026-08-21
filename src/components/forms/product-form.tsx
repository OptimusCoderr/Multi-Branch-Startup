"use client";

import { useActionState } from "react";

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
      <label className="flex flex-col gap-1 text-sm">
        SKU
        <input
          name="sku"
          defaultValue={defaultValues?.sku}
          className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Barcode <span className="text-gray-400">(optional)</span>
        <input
          name="barcode"
          defaultValue={defaultValues?.barcode ?? ""}
          placeholder="e.g. EAN-13 / UPC printed on the product"
          className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
        />
        <span className="text-xs text-gray-400">Scanned in the mobile app for POS-speed sales entry and stock counts.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          defaultValue={defaultValues?.name}
          className="rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2"
          rows={3}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Price
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.unitPrice}
            className="rounded-md border border-gray-300 px-3 py-2"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Cost price (optional)
          <input
            name="costPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.costPrice ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Reorder point (optional)
        <input
          name="reorderPoint"
          type="number"
          min="0"
          step="1"
          defaultValue={defaultValues?.reorderPoint ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <span className="text-xs text-gray-400">
          Get a low-stock alert once total stock across all locations falls to or below this number. Leave blank for no alert.
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          name="tracksBatches"
          type="checkbox"
          defaultChecked={defaultValues?.tracksBatches ?? false}
          className="mt-0.5 h-4 w-4 rounded border-gray-300"
        />
        <span>
          Perishable / tracked by batch
          <span className="block text-xs text-gray-400">
            e.g. yogurt, packaged juices. Every delivery of this product will require a batch number and expiry date, and
            older batches are sold first.
          </span>
        </span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
