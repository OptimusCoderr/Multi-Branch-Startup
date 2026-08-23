"use client";

import { useActionState } from "react";
import { createCompanyForCurrentUser } from "@/server/actions/onboarding";
import { CompanyNameField } from "@/components/forms/company-name-field";
import { CompanyBusinessTypeField } from "@/components/forms/company-business-type-field";
import { CompanyVerificationFields } from "@/components/forms/company-verification-fields";

const initialState = { error: "" };

export function CompanyStepForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: { error: string }, formData: FormData) => {
    const result = await createCompanyForCurrentUser(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You&apos;re signed in as {email}. Name your company to finish setting up your account.
      </p>

      <CompanyNameField />
      <CompanyBusinessTypeField />
      <CompanyVerificationFields />

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{ background: "var(--accent-gradient)" }}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
