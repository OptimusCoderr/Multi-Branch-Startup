"use client";

import { useActionState, useEffect } from "react";
import { adjustBranchStock } from "@/server/actions/stock-adjustments";
import { Field, Select, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string; success?: boolean };
const initialState: FormState = { error: "" };

/**
 * Admin quick-assign: directly increments a branch's stock for one fixed
 * product, no request/approval step. Reuses adjustBranchStock as-is (the
 * same "admin already has authority" escape hatch the /stock page's
 * AdjustBranchStockForm exposes) — this is just a product-scoped modal
 * wrapper around it, not a new backend path.
 */
export function AssignProductStockForm({
  productId,
  branches,
  onSuccess,
}: {
  productId: string;
  branches: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(adjustBranchStock, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />

      <Field label="Branch">
        <Select name="branchId" required>
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Quantity to add" hint="Use a negative number to remove stock instead.">
        <Input name="delta" type="number" step="1" required />
      </Field>

      <Field label="Reason" optional>
        <Input name="reason" placeholder="e.g. Initial stock, stock count correction" />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        Assign stock
      </Button>
    </form>
  );
}
