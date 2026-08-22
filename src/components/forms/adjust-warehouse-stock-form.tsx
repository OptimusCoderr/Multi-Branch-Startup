"use client";

import { useActionState } from "react";
import { adjustWarehouseStock } from "@/server/actions/stock-adjustments";
import { Card, Field, Select, Input, FormError, Button } from "@/components/ui";

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
    <Card>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <Field label="Product">
          <Select name="productId" required>
            <option value="">Select</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Warehouse">
          <Select name="warehouseId" required>
            <option value="">Select</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Adjustment (+/-)">
          <Input name="delta" type="number" step="1" required className="w-28" />
        </Field>

        <Field label="Reason">
          <Input name="reason" />
        </Field>

        <Button type="submit" size="sm" isPending={isPending} pendingLabel="Saving…">
          Apply
        </Button>

        <FormError error={state.error} />
      </form>
    </Card>
  );
}
