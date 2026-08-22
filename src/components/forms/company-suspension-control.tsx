"use client";

import { useActionState, useTransition } from "react";
import { disableCompany, enableCompany } from "@/server/actions/company-oversight";
import { AdminField, AdminTextarea, AdminFormError, AdminButton } from "@/components/ui-admin";

type FormState = { error: string };
const initialState: FormState = { error: "" };

/** SUPER_ADMIN-only security kill switch — independent of billing/subscription. */
export function CompanySuspensionControl({ companyId, isSuspended }: { companyId: string; isSuspended: boolean }) {
  const [isEnabling, startEnable] = useTransition();
  const [state, formAction, isDisabling] = useActionState(disableCompany.bind(null, companyId), initialState);

  if (isSuspended) {
    return (
      <AdminButton
        type="button"
        variant="primary"
        className="w-fit bg-green-600 hover:bg-green-500 focus-visible:ring-green-400"
        isPending={isEnabling}
        pendingLabel="Enabling…"
        onClick={() => startEnable(async () => { await enableCompany(companyId); })}
      >
        Enable account
      </AdminButton>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <AdminField label="Reason for disabling">
        <AdminTextarea name="reason" required rows={2} />
      </AdminField>
      <AdminFormError error={state.error} />
      <AdminButton type="submit" variant="danger" isPending={isDisabling} pendingLabel="Disabling…" className="w-fit">
        Disable account
      </AdminButton>
    </form>
  );
}
