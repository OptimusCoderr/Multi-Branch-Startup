"use client";

import { useActionState, useState } from "react";
import { createExpense } from "@/server/actions/expenses";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ExpenseForm({
  categories,
  branches,
}: {
  categories: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createExpense, initialState);
  const [isRecurring, setIsRecurring] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select name="categoryId" required className="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Branch
          <select name="branchId" className="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Company-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Amount
          <input name="amount" type="number" step="0.01" min="0" required className="rounded-md border border-gray-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            name="expenseDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea name="description" rows={2} className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isRecurring"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
        />
        This is a recurring expense
      </label>

      {isRecurring && (
        <label className="flex flex-col gap-1 text-sm">
          Recurs
          <select name="recurrenceInterval" required className="w-48 rounded-md border border-gray-300 px-3 py-2">
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY" selected>
              Monthly
            </option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Record expense"}
      </button>
    </form>
  );
}
