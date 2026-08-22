"use client";

import { useActionState } from "react";
import { rejectTransfer } from "@/server/actions/transfers";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function RejectTransferForm({ transferId }: { transferId: string }) {
  const [state, formAction, isPending] = useActionState(rejectTransfer.bind(null, transferId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Field label="Rejection reason">
        <Input name="reason" required />
      </Field>
      <FormError error={state.error} />
      <Button type="submit" variant="danger" size="sm" isPending={isPending} pendingLabel="Rejecting…" className="self-start">
        Reject
      </Button>
    </form>
  );
}
