"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function SupplierForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: { name: string; phone: string | null; email: string | null; address: string | null; notes: string | null };
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={defaultValues?.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" optional>
          <Input name="phone" defaultValue={defaultValues?.phone ?? ""} />
        </Field>
        <Field label="Email" optional>
          <Input name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        </Field>
      </div>

      <Field label="Address" optional>
        <Input name="address" defaultValue={defaultValues?.address ?? ""} />
      </Field>

      <Field label="Notes" optional>
        <Textarea name="notes" defaultValue={defaultValues?.notes ?? ""} rows={3} />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
