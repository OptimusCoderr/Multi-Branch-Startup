"use client";

import { useActionState } from "react";
import { createCompanyForCurrentUser } from "@/server/actions/onboarding";
import { CompanyNameField } from "@/components/forms/company-name-field";
import { CompanyVerificationFields } from "@/components/forms/company-verification-fields";

const initialState = { error: "" };

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(async (_prev: { error: string }, formData: FormData) => {
    const result = await createCompanyForCurrentUser(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <CompanyNameField />
      <CompanyVerificationFields />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{ background: "var(--accent-gradient)" }}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
