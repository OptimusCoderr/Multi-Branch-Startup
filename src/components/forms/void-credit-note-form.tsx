"use client";

import { useActionState } from "react";
import { voidCreditNote } from "@/server/actions/credit-notes";
import { Input, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function VoidCreditNoteForm({ saleId, creditNoteId }: { saleId: string; creditNoteId: string }) {
  const [state, formAction, isPending] = useActionState(voidCreditNote.bind(null, saleId, creditNoteId), initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input name="reason" required placeholder="Void reason" className="w-40" />
      <Button type="submit" variant="danger-link" isPending={isPending} pendingLabel="…">
        Void
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
