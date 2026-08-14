"use client";

import { useActionState, useMemo, useState } from "react";
import { createSale } from "@/server/actions/sales";
import { formatMoney } from "@/lib/format";

type FormState = { error: string };
const initialState: FormState = { error: "" };

type Product = { id: string; name: string; sku: string; unitPrice: string };

export function CreateSaleForm({
  branches,
  products,
  currency,
}: {
  branches: { id: string; name: string }[];
  products: Product[];
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState(createSale, initialState);
  const [rows, setRows] = useState<{ productId: string; quantity: number }[]>([{ productId: "", quantity: 1 }]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = rows.reduce((sum, row) => {
    const product = productById.get(row.productId);
    if (!product || row.quantity <= 0) return sum;
    return sum + Number(product.unitPrice) * row.quantity;
  }, 0);

  function updateRow(index: number, patch: Partial<{ productId: string; quantity: number }>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const validLineItems = rows.filter((r) => r.productId && r.quantity > 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lineItems" value={JSON.stringify(validLineItems)} />

      <label className="flex flex-col gap-1 text-sm">
        Branch
        <select name="branchId" required className="rounded-md border border-gray-300 px-3 py-2">
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Customer name
          <input name="customerName" className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input name="customerPhone" className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="customerEmail" type="email" className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Line items</p>
        {rows.map((row, i) => {
          const product = productById.get(row.productId);
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.productId}
                onChange={(e) => updateRow(i, { productId: e.target.value })}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {formatMoney(p.unitPrice, currency)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                className="w-24 rounded-md border border-gray-300 px-3 py-2"
              />
              <span className="w-28 text-right text-sm text-gray-500">
                {product ? formatMoney(Number(product.unitPrice) * row.quantity, currency) : "—"}
              </span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="text-sm text-red-600 hover:underline disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" onClick={addRow} className="self-start text-sm text-blue-600 hover:underline">
          + Add product
        </button>
      </div>

      <div className="flex justify-end text-lg font-semibold">Total: {formatMoney(total, currency)}</div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending || validLineItems.length === 0}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Record sale"}
      </button>
    </form>
  );
}
