"use client";

import { useActionState } from "react";
import { createExpenseCategory } from "@/server/actions/expenses";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ExpenseCategoryForm() {
  const [state, formAction, isPending] = useActionState(createExpenseCategory, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        New category
        <input name="name" required className="rounded-md border border-gray-300 px-3 py-2" placeholder="e.g. Insurance" />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add category"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
