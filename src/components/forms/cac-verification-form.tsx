"use client";

import { useActionState } from "react";
import { submitCacVerification } from "@/server/actions/verification";

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
      <label className="flex flex-col gap-1 text-sm">
        CAC RC number <span className="text-gray-400">(optional)</span>
        <input
          name="rcNumber"
          defaultValue={defaultValues.rcNumber ?? ""}
          placeholder="e.g. RC1234567"
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Company incorporation date <span className="text-gray-400">(optional)</span>
        <input
          name="incorporationDate"
          type="date"
          defaultValue={defaultValues.incorporationDate ?? ""}
          max={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Link to your CAC certificate
        <input
          name="cacCertificateUrl"
          type="url"
          required
          placeholder="https://drive.google.com/…"
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <span className="text-xs text-gray-400">
          Upload the certificate somewhere you control (Google Drive, Dropbox, etc.), share it so anyone with the
          link can view it, and paste that link here.
        </span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}
