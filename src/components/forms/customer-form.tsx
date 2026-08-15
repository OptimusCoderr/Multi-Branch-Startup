"use client";

import { useActionState } from "react";

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
  };
  submitLabel: string;
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

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input name="phone" defaultValue={defaultValues?.phone ?? ""} className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Address
        <input name="address" defaultValue={defaultValues?.address ?? ""} className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Credit limit (optional)
        <input
          name="creditLimit"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.creditLimit ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2"
          rows={3}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
