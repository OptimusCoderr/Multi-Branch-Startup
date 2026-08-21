"use client";

import { useActionState, useState } from "react";
import { voidExpense } from "@/server/actions/expenses";
import { Input, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function VoidExpenseForm({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(voidExpense.bind(null, expenseId), initialState);

  if (!open) {
    return (
      <Button type="button" variant="danger-link" onClick={() => setOpen(true)}>
        Void
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input name="reason" required placeholder="Reason" className="w-32" />
      <Button type="submit" variant="danger-link" isPending={isPending} pendingLabel="…">
        Confirm
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
