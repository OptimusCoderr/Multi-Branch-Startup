"use client";

import { useActionState } from "react";
import { createCompanyForCurrentUser } from "@/server/actions/onboarding";
import { CompanyNameField } from "@/components/forms/company-name-field";
import { useAuthTheme } from "@/components/auth/auth-theme";

const initialState = { error: "" };

export function CompanyStepForm({ email }: { email: string }) {
  const { accent } = useAuthTheme();
  const [state, formAction, isPending] = useActionState(async (_prev: { error: string }, formData: FormData) => {
    const result = await createCompanyForCurrentUser(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        You&apos;re signed in as {email}. Name your company to finish setting up your account.
      </p>

      <CompanyNameField />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{ backgroundColor: accent }}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
