"use client";

import { useActionState, useEffect } from "react";
import { adjustWarehouseStock } from "@/server/actions/stock-adjustments";
import { Card, Field, Select, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string; success?: boolean };
const initialState: FormState = { error: "" };

/**
 * Used two ways: a top-level any-product/any-warehouse form on /stock, and
 * — once `fixedWarehouseId` is passed — a per-warehouse inline form on the
 * Warehouses page's expandable card, where the warehouse is already
 * implied by context so only the product needs picking.
 */
export function AdjustWarehouseStockForm({
  products,
  warehouses,
  fixedWarehouseId,
  onSuccess,
}: {
  products: { id: string; name: string; sku: string }[];
  warehouses: { id: string; name: string }[];
  fixedWarehouseId?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(adjustWarehouseStock, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

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

        {fixedWarehouseId ? (
          <input type="hidden" name="warehouseId" value={fixedWarehouseId} />
        ) : (
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
        )}

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
