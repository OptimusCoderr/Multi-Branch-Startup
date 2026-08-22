"use client";

import { useActionState, useMemo, useState } from "react";
import { createPurchaseOrder } from "@/server/actions/purchase-orders";
import { formatMoney } from "@/lib/format";
import { Field, Input, Select, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

type Product = { id: string; name: string; sku: string };
type Supplier = { id: string; name: string };
type Location = { id: string; name: string };

export function CreatePurchaseOrderForm({
  suppliers,
  products,
  warehouses,
  branches,
  currency,
}: {
  suppliers: Supplier[];
  products: Product[];
  warehouses: Location[];
  branches: Location[];
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrder, initialState);
  const [rows, setRows] = useState<{ productId: string; quantityOrdered: number; unitCost: number }[]>([
    { productId: "", quantityOrdered: 1, unitCost: 0 },
  ]);

  const canOrderToWarehouse = warehouses.length > 0;
  const canOrderToBranch = branches.length > 0;
  const [destinationType, setDestinationType] = useState<"WAREHOUSE" | "BRANCH">(canOrderToWarehouse ? "WAREHOUSE" : "BRANCH");
  const showDestinationTypePicker = canOrderToWarehouse && canOrderToBranch;

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = rows.reduce((sum, row) => {
    if (!productById.get(row.productId) || row.quantityOrdered <= 0) return sum;
    return sum + row.unitCost * row.quantityOrdered;
  }, 0);

  function updateRow(index: number, patch: Partial<{ productId: string; quantityOrdered: number; unitCost: number }>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: "", quantityOrdered: 1, unitCost: 0 }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const validLineItems = rows.filter((r) => r.productId && r.quantityOrdered > 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lineItems" value={JSON.stringify(validLineItems)} />

      <Field label="Supplier">
        <Select name="supplierId" required>
          <option value="">Select a supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      {showDestinationTypePicker && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-0.5 text-gray-500">Deliver to</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="destinationType"
                value="WAREHOUSE"
                checked={destinationType === "WAREHOUSE"}
                onChange={() => setDestinationType("WAREHOUSE")}
              />
              A warehouse
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="destinationType"
                value="BRANCH"
                checked={destinationType === "BRANCH"}
                onChange={() => setDestinationType("BRANCH")}
              />
              A branch
            </label>
          </div>
        </fieldset>
      )}
      {!showDestinationTypePicker && <input type="hidden" name="destinationType" value={destinationType} />}

      {destinationType === "WAREHOUSE" ? (
        <Field label="Destination warehouse">
          <Select name="destinationWarehouseId" required>
            <option value="">Select a warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Destination branch">
          <Select name="destinationBranchId" required>
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Expected delivery date" optional>
        <Input name="expectedDate" type="date" className="w-48" />
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Line items</p>
        {rows.map((row, i) => {
          const product = productById.get(row.productId);
          return (
            <div key={i} className="flex items-center gap-2">
              <Select value={row.productId} onChange={(e) => updateRow(i, { productId: e.target.value })} className="flex-1">
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="1"
                step="1"
                value={row.quantityOrdered}
                onChange={(e) => updateRow(i, { quantityOrdered: Number(e.target.value) })}
                className="w-20"
                aria-label="Quantity"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={row.unitCost}
                onChange={(e) => updateRow(i, { unitCost: Number(e.target.value) })}
                className="w-28"
                aria-label="Unit cost"
              />
              <span className="w-28 text-right text-sm text-gray-500">
                {product ? formatMoney(row.unitCost * row.quantityOrdered, currency) : "—"}
              </span>
              <Button type="button" variant="danger-link" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                Remove
              </Button>
            </div>
          );
        })}
        <Button type="button" variant="link" onClick={addRow} className="self-start">
          + Add product
        </Button>
      </div>

      <Field label="Notes" optional>
        <Input name="notes" />
      </Field>

      <div className="flex justify-end text-lg font-semibold">Total cost: {formatMoney(total, currency)}</div>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Creating…" disabled={validLineItems.length === 0}>
        Create purchase order
      </Button>
    </form>
  );
}
