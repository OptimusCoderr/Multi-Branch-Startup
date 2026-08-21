"use client";

import { useActionState, useState } from "react";
import { createExpense } from "@/server/actions/expenses";
import { Field, Input, Textarea, Select, Checkbox, FormError, Button } from "@/components/ui";

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
        <Field label="Category">
          <Select name="categoryId" required>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Branch">
          <Select name="branchId">
            <option value="">Company-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount">
          <Input name="amount" type="number" step="0.01" min="0" required />
        </Field>

        <Field label="Date">
          <Input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
      </div>

      <Field label="Description" optional>
        <Textarea name="description" rows={2} />
      </Field>

      <Checkbox
        name="isRecurring"
        checked={isRecurring}
        onChange={(e) => setIsRecurring(e.target.checked)}
        label="This is a recurring expense"
      />

      {isRecurring && (
        <Field label="Recurs">
          <Select name="recurrenceInterval" required defaultValue="MONTHLY" className="w-48">
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </Select>
        </Field>
      )}

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        Record expense
      </Button>
    </form>
  );
}
