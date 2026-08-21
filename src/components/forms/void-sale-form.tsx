"use client";

import { useActionState } from "react";
import { voidSale } from "@/server/actions/sales";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function VoidSaleForm({ saleId }: { saleId: string }) {
  const [state, formAction, isPending] = useActionState(voidSale.bind(null, saleId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Field label="Void reason">
        <Input name="reason" required />
      </Field>
      <FormError error={state.error} />
      <Button type="submit" variant="danger" isPending={isPending} pendingLabel="Voiding…" className="self-start">
        Void sale
      </Button>
    </form>
  );
}
