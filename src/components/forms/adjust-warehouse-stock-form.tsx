"use client";

import { useActionState } from "react";
import { adjustWarehouseStock } from "@/server/actions/stock-adjustments";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function AdjustWarehouseStockForm({
  products,
  warehouses,
}: {
  products: { id: string; name: string; sku: string }[];
  warehouses: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(adjustWarehouseStock, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4">
      <label className="flex flex-col gap-1 text-sm">
        Product
        <select name="productId" required className="rounded-md border border-gray-300 px-2 py-1.5">
          <option value="">Select</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Warehouse
        <select name="warehouseId" required className="rounded-md border border-gray-300 px-2 py-1.5">
          <option value="">Select</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Adjustment (+/-)
        <input name="delta" type="number" step="1" required className="w-28 rounded-md border border-gray-300 px-2 py-1.5" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Reason
        <input name="reason" className="rounded-md border border-gray-300 px-2 py-1.5" />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Apply"}
      </button>

      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
