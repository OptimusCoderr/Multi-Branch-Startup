"use client";

import { useActionState } from "react";
import { voidCreditNote } from "@/server/actions/credit-notes";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function VoidCreditNoteForm({ saleId, creditNoteId }: { saleId: string; creditNoteId: string }) {
  const [state, formAction, isPending] = useActionState(voidCreditNote.bind(null, saleId, creditNoteId), initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="reason" required placeholder="Void reason" className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs" />
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "…" : "Void"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
