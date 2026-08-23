"use client";

import { useActionState } from "react";
import { recordPayment } from "@/server/actions/sales";
import { Field, Input, Select, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

const PAYMENT_MODES = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"] as const;

export function RecordPaymentForm({ saleId, outstanding }: { saleId: string; outstanding: string }) {
  const [state, formAction, isPending] = useActionState(recordPayment.bind(null, saleId), initialState);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding balance: {outstanding}</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input name="amount" type="number" step="0.01" min="0.01" required />
          </Field>
          <Field label="Mode">
            <Select name="mode" required>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Reference" optional>
          <Input name="reference" />
        </Field>

        <FormError error={state.error} />

        <Button type="submit" isPending={isPending} pendingLabel="Recording…" className="self-start">
          Record payment
        </Button>
      </form>
    </Card>
  );
}
