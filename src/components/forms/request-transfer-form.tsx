"use client";

import { useActionState, useState } from "react";
import { requestTransfer } from "@/server/actions/transfers";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function RequestTransferForm({
  products,
  warehouses,
  branches,
}: {
  products: { id: string; name: string; sku: string }[];
  warehouses: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(requestTransfer, initialState);

  const canSourceFromWarehouse = warehouses.length > 0;
  const canSourceFromBranch = branches.length >= 2;
  const [sourceType, setSourceType] = useState<"WAREHOUSE" | "BRANCH">(canSourceFromWarehouse ? "WAREHOUSE" : "BRANCH");
  const [sourceBranchId, setSourceBranchId] = useState("");

  const showSourceTypePicker = canSourceFromWarehouse && canSourceFromBranch;

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

      {showSourceTypePicker && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-0.5 text-gray-500">Source</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="sourceType"
                value="WAREHOUSE"
                checked={sourceType === "WAREHOUSE"}
                onChange={() => setSourceType("WAREHOUSE")}
              />
              A warehouse
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="sourceType"
                value="BRANCH"
                checked={sourceType === "BRANCH"}
                onChange={() => setSourceType("BRANCH")}
              />
              Another branch
            </label>
          </div>
        </fieldset>
      )}
      {!showSourceTypePicker && <input type="hidden" name="sourceType" value={sourceType} />}

      {sourceType === "WAREHOUSE" ? (
        <label className="flex flex-col gap-1 text-sm">
          Source warehouse
          <select name="sourceWarehouseId" required className="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Select a warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Source branch
          <select
            name="sourceBranchId"
            required
            value={sourceBranchId}
            onChange={(e) => setSourceBranchId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Destination branch
        <select name="destinationBranchId" required className="rounded-md border border-gray-300 px-3 py-2">
          <option value="">Select a branch</option>
          {branches
            .filter((b) => sourceType !== "BRANCH" || b.id !== sourceBranchId)
            .map((b) => (
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
        Notes (optional)
        <input name="notes" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Requesting…" : "Request transfer"}
      </button>
    </form>
  );
}
