"use client";

import { useActionState } from "react";
import { flagSale } from "@/server/actions/sale-flags";
import { Field, Input, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function FlagSaleForm({ saleId }: { saleId: string }) {
  const [state, formAction, isPending] = useActionState(flagSale.bind(null, saleId), initialState);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-2">
        <p className="text-sm font-medium">Flag this sale</p>
        <Field label="Reason" hint="The submitter is notified and must correct and resubmit before midnight today.">
          <Input name="reason" required />
        </Field>
        <FormError error={state.error} />
        <Button type="submit" variant="danger" isPending={isPending} pendingLabel="Flagging…" className="self-start">
          Flag sale
        </Button>
      </form>
    </Card>
  );
}
