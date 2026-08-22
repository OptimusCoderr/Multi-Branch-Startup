"use client";

import { useActionState } from "react";
import { createExpenseCategory } from "@/server/actions/expenses";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ExpenseCategoryForm() {
  const [state, formAction, isPending] = useActionState(createExpenseCategory, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <Field label="New category">
        <Input name="name" required placeholder="e.g. Insurance" />
      </Field>
      <Button type="submit" variant="secondary" isPending={isPending} pendingLabel="Adding…">
        Add category
      </Button>
      <FormError error={state.error} />
    </form>
  );
}
