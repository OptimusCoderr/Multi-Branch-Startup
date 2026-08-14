"use client";

import { useActionState } from "react";

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
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          defaultValue={defaultValues?.name}
          className="rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Address
        <input
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      {showPhone && (
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input
            name="phone"
            defaultValue={defaultValues?.phone ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
