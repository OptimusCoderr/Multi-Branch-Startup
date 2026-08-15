"use client";

import { useActionState, useState } from "react";
import { voidExpense } from "@/server/actions/expenses";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function VoidExpenseForm({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(voidExpense.bind(null, expenseId), initialState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-red-600 hover:underline">
        Void
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="reason" required placeholder="Reason" className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs" />
      <button type="submit" disabled={isPending} className="text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "…" : "Confirm"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
