"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Checkbox, FormError, Button } from "@/components/ui";

type CustomerFormState = { error: string };
const initialState: CustomerFormState = { error: "" };

export function CustomerForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  defaultValues?: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    creditLimit: string | null;
    remindersEnabled: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={defaultValues?.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" defaultValue={defaultValues?.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        </Field>
      </div>

      <Field label="Address">
        <Input name="address" defaultValue={defaultValues?.address ?? ""} />
      </Field>

      <Field label="Credit limit" optional>
        <Input name="creditLimit" type="number" step="0.01" min="0" defaultValue={defaultValues?.creditLimit ?? ""} />
      </Field>

      <Field label="Notes">
        <Textarea name="notes" defaultValue={defaultValues?.notes ?? ""} rows={3} />
      </Field>

      <Checkbox
        name="remindersEnabled"
        defaultChecked={defaultValues?.remindersEnabled ?? true}
        label="Allow automated payment reminders to this customer"
      />

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
