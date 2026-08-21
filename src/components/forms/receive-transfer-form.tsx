"use client";

import { useActionState } from "react";
import { receiveTransfer } from "@/server/actions/transfers";
import { Field, Input, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ReceiveTransferForm({
  transferId,
  expectedQuantity,
  requiresManualBatch,
}: {
  transferId: string;
  expectedQuantity: number;
  requiresManualBatch?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(receiveTransfer.bind(null, transferId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Field label="Quantity received">
        <Input name="receivedQuantity" type="number" min="0" step="1" defaultValue={expectedQuantity} required />
      </Field>
      <Field label="Notes" hint="Required if the amount doesn't match">
        <Input name="notes" />
      </Field>

      {requiresManualBatch && (
        <Card variant="warning">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-amber-800">
              This product is perishable / batch-tracked, and the source location had no existing batch to carry
              over — batch details are required for this receipt.
            </p>
            <Field label="Batch number">
              <Input name="batchNumber" required className="font-mono text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Manufacture date" optional>
                <Input name="manufactureDate" type="date" />
              </Field>
              <Field label="Expiry date">
                <Input name="expiryDate" type="date" required />
              </Field>
            </div>
          </div>
        </Card>
      )}

      <FormError error={state.error} />
      <Button type="submit" size="sm" isPending={isPending} pendingLabel="Recording…" className="self-start">
        Confirm receipt
      </Button>
    </form>
  );
}
