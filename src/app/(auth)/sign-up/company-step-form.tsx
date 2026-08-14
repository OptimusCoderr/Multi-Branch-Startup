"use client";

import { useActionState } from "react";
import { createCompanyForCurrentUser } from "@/server/actions/onboarding";

const initialState = { error: "" };

export function CompanyStepForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: { error: string }, formData: FormData) => {
    const result = await createCompanyForCurrentUser(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        You&apos;re signed in as {email}. Name your company to finish setting up your account.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Company name
        <input
          name="companyName"
          autoFocus
          className="rounded-md border border-gray-300 px-3 py-2"
          required
          minLength={2}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
