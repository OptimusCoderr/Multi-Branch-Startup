"use client";

import { useActionState, useState } from "react";
import { requestTransfer } from "@/server/actions/transfers";
import { Field, Input, Select, FormError, Button } from "@/components/ui";

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
      <Field label="Product">
        <Select name="productId" required>
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>
      </Field>

      {showSourceTypePicker && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-0.5 text-gray-500 dark:text-gray-400">Source</legend>
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
        <Field label="Source warehouse">
          <Select name="sourceWarehouseId" required>
            <option value="">Select a warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Source branch">
          <Select name="sourceBranchId" required value={sourceBranchId} onChange={(e) => setSourceBranchId(e.target.value)}>
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Destination branch">
        <Select name="destinationBranchId" required>
          <option value="">Select a branch</option>
          {branches
            .filter((b) => sourceType !== "BRANCH" || b.id !== sourceBranchId)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </Select>
      </Field>

      <Field label="Quantity">
        <Input name="quantity" type="number" min="1" step="1" required />
      </Field>

      <Field label="Notes" optional>
        <Input name="notes" />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Requesting…">
        Request transfer
      </Button>
    </form>
  );
}
