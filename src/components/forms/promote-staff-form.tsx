"use client";

import { useActionState, useState } from "react";
import { promotePlatformStaff } from "@/server/actions/platform-admin";
import { AdminCard, AdminField, AdminInput, AdminSelect, AdminFormError, AdminButton } from "@/components/ui-admin";

type FormState = { error: string; password?: string; email?: string };
const initialState: FormState = { error: "" };

export function PromoteStaffForm() {
  const [state, formAction, isPending] = useActionState(promotePlatformStaff, initialState);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!state.password) return;
    await navigator.clipboard.writeText(state.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminCard className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <AdminField label="Email">
          <AdminInput name="email" type="email" required className="w-64" />
        </AdminField>
        <AdminField label="Role">
          <AdminSelect name="role" defaultValue="SUPPORT_AGENT">
            <option value="SUPPORT_AGENT">Support agent</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </AdminSelect>
        </AdminField>
        <AdminButton
          type="submit"
          className="bg-amber-500 text-gray-950 hover:bg-amber-400 focus-visible:ring-amber-300"
          isPending={isPending}
          pendingLabel="Adding…"
        >
          Add to platform team
        </AdminButton>
      </form>

      <AdminFormError error={state.error} />

      {state.password && (
        <div className="rounded-lg bg-gray-950 p-3 text-sm">
          <p className="text-gray-400">
            New account created for {state.email}. Share this password with them directly — it&apos;s shown once and
            not stored anywhere.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-gray-900 px-2 py-1 text-xs text-gray-200">{state.password}</code>
            <button type="button" onClick={copyPassword} className="text-amber-400 hover:underline">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
