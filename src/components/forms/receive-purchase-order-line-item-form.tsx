"use client";

import { useActionState } from "react";
import { receivePurchaseOrderLineItem } from "@/server/actions/purchase-orders";
import { Field, Input, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ReceivePurchaseOrderLineItemForm({
  purchaseOrderId,
  lineItemId,
  remainingQuantity,
  requiresBatch,
}: {
  purchaseOrderId: string;
  lineItemId: string;
  remainingQuantity: number;
  requiresBatch: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    receivePurchaseOrderLineItem.bind(null, purchaseOrderId, lineItemId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label="Quantity received">
          <Input name="quantityReceived" type="number" min="1" max={remainingQuantity} step="1" defaultValue={remainingQuantity} required className="w-32" />
        </Field>
        <Button type="submit" size="sm" isPending={isPending} pendingLabel="Recording…">
          Receive
        </Button>
      </div>

      {requiresBatch && (
        <Card variant="warning">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-amber-800">This product is perishable / batch-tracked — batch details are required.</p>
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
    </form>
  );
}
