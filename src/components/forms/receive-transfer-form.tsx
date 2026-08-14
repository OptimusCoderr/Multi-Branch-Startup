"use client";

import { useActionState } from "react";
import { receiveTransfer } from "@/server/actions/transfers";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ReceiveTransferForm({ transferId, expectedQuantity }: { transferId: string; expectedQuantity: number }) {
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
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Confirm receipt"}
      </button>
    </form>
  );
}
