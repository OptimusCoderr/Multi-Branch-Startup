"use client";

import { useActionState } from "react";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function LocationForm({
  action,
  defaultValues,
  submitLabel,
  showPhone,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: { name: string; address: string | null; phone?: string | null };
  submitLabel: string;
  showPhone?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={defaultValues?.name} required />
      </Field>

      <Field label="Address">
        <Input name="address" defaultValue={defaultValues?.address ?? ""} />
      </Field>

      {showPhone && (
        <Field label="Phone">
          <Input name="phone" defaultValue={defaultValues?.phone ?? ""} />
        </Field>
      )}

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
