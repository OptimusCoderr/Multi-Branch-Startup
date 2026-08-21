"use client";

import { useActionState, useMemo, useState } from "react";
import { receiveExternalStock } from "@/server/actions/transfers";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ReceiveExternalForm({
  products,
  branches,
}: {
  products: { id: string; name: string; sku: string; tracksBatches: boolean }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(receiveExternalStock, initialState);
  const [productId, setProductId] = useState("");

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const requiresBatch = selectedProduct?.tracksBatches ?? false;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Product
        <select
          name="productId"
          required
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
              {p.tracksBatches ? " — batch tracked" : ""}
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

      {requiresBatch && (
        <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            This product is perishable / batch-tracked — batch details are required for this delivery.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Batch number
            <input
              name="batchNumber"
              required={requiresBatch}
              className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Manufacture date (optional)
              <input name="manufactureDate" type="date" className="rounded-md border border-gray-300 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Expiry date
              <input
                name="expiryDate"
                type="date"
                required={requiresBatch}
                className="rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Notes (optional)
        <input name="notes" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Record delivery"}
      </button>
    </form>
  );
}
