"use client";

import { useActionState, useEffect } from "react";
import { rejectTransfer } from "@/server/actions/transfers";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string; success?: boolean };
const initialState: FormState = { error: "" };

export function RejectTransferForm({ transferId, onSuccess }: { transferId: string; onSuccess?: () => void }) {
  const [state, formAction, isPending] = useActionState(rejectTransfer.bind(null, transferId), initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

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
