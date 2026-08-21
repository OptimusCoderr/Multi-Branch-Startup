"use client";

import { useActionState, useTransition } from "react";
import { disableCompany, enableCompany } from "@/server/actions/company-oversight";

type FormState = { error: string };
const initialState: FormState = { error: "" };

/** SUPER_ADMIN-only security kill switch — independent of billing/subscription. */
export function CompanySuspensionControl({ companyId, isSuspended }: { companyId: string; isSuspended: boolean }) {
  const [isEnabling, startEnable] = useTransition();
  const [state, formAction, isDisabling] = useActionState(disableCompany.bind(null, companyId), initialState);

  if (isSuspended) {
    return (
      <button
        type="button"
        disabled={isEnabling}
        onClick={() => startEnable(async () => { await enableCompany(companyId); })}
        className="w-fit rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isEnabling ? "Enabling…" : "Enable account"}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-gray-400">
        Reason for disabling
        <textarea name="reason" required rows={2} className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
      </label>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={isDisabling}
        className="w-fit rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isDisabling ? "Disabling…" : "Disable account"}
      </button>
    </form>
  );
}
