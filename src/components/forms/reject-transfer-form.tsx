"use client";

import { useActionState } from "react";
import { rejectTransfer } from "@/server/actions/transfers";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function RejectTransferForm({ transferId }: { transferId: string }) {
  const [state, formAction, isPending] = useActionState(rejectTransfer.bind(null, transferId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Rejection reason
        <input name="reason" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Rejecting…" : "Reject"}
      </button>
    </form>
  );
}
