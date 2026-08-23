"use client";

import { useActionState } from "react";
import { requestTransfer } from "@/server/actions/transfers";
import { Field, Input, Select, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function RequestTransferForm({
  products,
  branches,
}: {
  products: { id: string; name: string; sku: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(requestTransfer, initialState);

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
