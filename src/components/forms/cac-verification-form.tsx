"use client";

import { useActionState } from "react";
import { submitCacVerification } from "@/server/actions/verification";
import { Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function CacVerificationForm({
  defaultValues,
  submitLabel,
}: {
  defaultValues: { rcNumber: string | null; incorporationDate: string | null };
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(submitCacVerification, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field label="CAC RC number" optional>
        <Input name="rcNumber" defaultValue={defaultValues.rcNumber ?? ""} placeholder="e.g. RC1234567" />
      </Field>

      <Field label="Company incorporation date" optional>
        <Input
          name="incorporationDate"
          type="date"
          defaultValue={defaultValues.incorporationDate ?? ""}
          max={new Date().toISOString().slice(0, 10)}
        />
      </Field>

      <Field
        label="Link to your CAC certificate"
        hint="Upload the certificate somewhere you control (Google Drive, Dropbox, etc.), share it so anyone with the link can view it, and paste that link here."
      >
        <Input name="cacCertificateUrl" type="url" required placeholder="https://drive.google.com/…" />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Submitting…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
