"use client";

import { useActionState } from "react";
import { issueCreditNote } from "@/server/actions/credit-notes";
import { Field, Input, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function IssueCreditNoteForm({ saleId, outstanding }: { saleId: string; outstanding: string }) {
  const [state, formAction, isPending] = useActionState(issueCreditNote.bind(null, saleId), initialState);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">Outstanding balance: {outstanding}</p>

        <Field label="Amount">
          <Input name="amount" type="number" step="0.01" min="0.01" required />
        </Field>

        <Field label="Reason">
          <Input name="reason" required placeholder="e.g. Damaged item, price adjustment" />
        </Field>

        <FormError error={state.error} />

        <Button type="submit" isPending={isPending} pendingLabel="Issuing…" className="self-start">
          Issue credit note
        </Button>
      </form>
    </Card>
  );
}
