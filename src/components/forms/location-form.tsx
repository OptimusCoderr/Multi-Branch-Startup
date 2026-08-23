"use client";

import { useActionState, useEffect } from "react";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string; success?: boolean };
const initialState: FormState = { error: "" };

export function LocationForm({
  action,
  defaultValues,
  submitLabel,
  showPhone,
  onSuccess,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: { name: string; address: string | null; phone?: string | null };
  submitLabel: string;
  showPhone?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

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
