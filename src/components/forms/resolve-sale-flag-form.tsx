"use client";

import { useActionState } from "react";
import { resolveSaleFlag } from "@/server/actions/sale-flags";
import { Field, Input, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ResolveSaleFlagForm({
  flagId,
  saleId,
  currentName,
  currentPhone,
  currentEmail,
  currentDueDate,
}: {
  flagId: string;
  saleId: string;
  currentName: string | null;
  currentPhone: string | null;
  currentEmail: string | null;
  currentDueDate: string | null;
}) {
  const [state, formAction, isPending] = useActionState(resolveSaleFlag.bind(null, flagId, saleId), initialState);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        <p className="text-sm font-medium">Correct and resubmit</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Only the customer name, phone, email, and due date can be corrected here — a mistaken quantity or price still needs a void
          instead.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer name" optional>
            <Input name="customerName" defaultValue={currentName ?? ""} />
          </Field>
          <Field label="Phone" optional>
            <Input name="customerPhone" defaultValue={currentPhone ?? ""} />
          </Field>
          <Field label="Email" optional>
            <Input name="customerEmail" type="email" defaultValue={currentEmail ?? ""} />
          </Field>
          <Field label="Due date" optional>
            <Input name="dueDate" type="date" defaultValue={currentDueDate ?? ""} />
          </Field>
        </div>
        <Field label="What did you correct?">
          <Input name="note" required />
        </Field>
        <FormError error={state.error} />
        <Button type="submit" isPending={isPending} pendingLabel="Resubmitting…" className="self-start">
          Resubmit
        </Button>
      </form>
    </Card>
  );
}
