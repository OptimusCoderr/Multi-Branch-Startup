"use client";

import { useActionState } from "react";
import { receiveTransfer } from "@/server/actions/transfers";

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
      <label className="flex flex-col gap-1 text-sm">
        Quantity received
        <input
          name="receivedQuantity"
          type="number"
          min="0"
          step="1"
          defaultValue={expectedQuantity}
          required
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes (required if the amount doesn&apos;t match)
        <input name="notes" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      {requiresManualBatch && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            This product is perishable / batch-tracked, and the source location had no existing batch to carry
            over — batch details are required for this receipt.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Batch number
            <input
              name="batchNumber"
              required
              className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Manufacture date (optional)
              <input name="manufactureDate" type="date" className="rounded-md border border-gray-300 px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Expiry date
              <input name="expiryDate" type="date" required className="rounded-md border border-gray-300 px-3 py-2" />
            </label>
          </div>
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Confirm receipt"}
      </button>
    </form>
  );
}
