"use client";

import { useActionState } from "react";
import { issueCreditNote } from "@/server/actions/credit-notes";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function IssueCreditNoteForm({ saleId, outstanding }: { saleId: string; outstanding: string }) {
  const [state, formAction, isPending] = useActionState(issueCreditNote.bind(null, saleId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">Outstanding balance: {outstanding}</p>

      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input name="amount" type="number" step="0.01" min="0.01" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Reason
        <input name="reason" required placeholder="e.g. Damaged item, price adjustment" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Issuing…" : "Issue credit note"}
      </button>
    </form>
  );
}
