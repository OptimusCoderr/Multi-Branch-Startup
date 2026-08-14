"use client";

import { useActionState } from "react";
import { receiveExternalStock } from "@/server/actions/transfers";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ReceiveExternalForm({
  products,
  branches,
}: {
  products: { id: string; name: string; sku: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(receiveExternalStock, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Product
        <select name="productId" required className="rounded-md border border-gray-300 px-3 py-2">
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Receiving branch
        <select name="destinationBranchId" required className="rounded-md border border-gray-300 px-3 py-2">
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Quantity
        <input name="quantity" type="number" min="1" step="1" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Supplier / source
        <input name="externalSourceName" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notes (optional)
        <input name="notes" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Record delivery"}
      </button>
    </form>
  );
}
