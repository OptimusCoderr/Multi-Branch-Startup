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
  defaultValues?: { sku: string; name: string; description: string | null; unitPrice: string; costPrice: string | null };
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

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
