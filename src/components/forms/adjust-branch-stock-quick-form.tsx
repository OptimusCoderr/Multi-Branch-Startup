"use client";

import { useActionState, useEffect } from "react";
import { adjustBranchStock } from "@/server/actions/stock-adjustments";
import { Field, Select, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string; success?: boolean };
const initialState: FormState = { error: "" };

/**
 * Admin quick-correction for the Branch Stock page's "Adjust stock" mode —
 * branch is already implied by which branch the page is scoped to, so only
 * the product needs picking. Mirror image of Phase 3's
 * assign-product-stock-form.tsx (product fixed, branch picked) and reuses
 * the same underlying adjustBranchStock action.
 */
export function AdjustBranchStockQuickForm({
  branchId,
  products,
  onSuccess,
}: {
  branchId: string;
  products: { id: string; name: string; sku: string }[];
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(adjustBranchStock, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="branchId" value={branchId} />

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

      <Field label="Adjustment (+/-)" hint="Use a negative number to remove stock.">
        <Input name="delta" type="number" step="1" required />
      </Field>

      <Field label="Reason" optional>
        <Input name="reason" placeholder="e.g. Stock count correction" />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        Adjust stock
      </Button>
    </form>
  );
}
