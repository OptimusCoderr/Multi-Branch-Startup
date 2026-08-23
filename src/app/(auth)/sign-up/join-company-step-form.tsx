"use client";

import { useActionState } from "react";
import { requestToJoinCompany } from "@/server/actions/staff-signup";
import { useAuthTheme } from "@/components/auth/auth-theme";

const initialState = { error: "" };

export function JoinCompanyStepForm({ email }: { email: string }) {
  const { accent } = useAuthTheme();
  const [state, formAction, isPending] = useActionState(async (_prev: { error: string }, formData: FormData) => {
    const result = await requestToJoinCompany(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You&apos;re signed in as {email}. Enter your employer&apos;s company code to request access — an Owner will
        need to approve your request and assign you a role before you can sign in.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Company code
        <input
          name="companyCode"
          autoFocus
          required
          placeholder="e.g. BIZ-4F82K9QZ or your RC number"
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        />
      </label>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{ background: "var(--accent-gradient)" }}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Sending request…" : "Request to join"}
      </button>
    </form>
  );
}
