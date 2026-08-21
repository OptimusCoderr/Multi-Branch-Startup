"use client";

import { useActionState, useState } from "react";
import { generatePasswordResetLink } from "@/server/actions/platform-admin";
import { AdminCard, AdminField, AdminInput, AdminFormError, AdminButton } from "@/components/ui-admin";

type FormState = { error: string; link?: string };
const initialState: FormState = { error: "" };

export function PasswordResetTool() {
  const [state, formAction, isPending] = useActionState(generatePasswordResetLink, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.link) return;
    await navigator.clipboard.writeText(state.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminCard className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <AdminField label="User's email">
          <AdminInput name="email" type="email" required className="w-72" />
        </AdminField>
        <AdminButton
          type="submit"
          className="bg-amber-500 text-gray-950 hover:bg-amber-400 focus-visible:ring-amber-300"
          isPending={isPending}
          pendingLabel="Generating…"
        >
          Generate reset link
        </AdminButton>
      </form>

      <AdminFormError error={state.error} />

      {state.link && (
        <div className="rounded-lg bg-gray-950 p-3 text-sm">
          <p className="text-gray-400">
            Share this link with the user directly (phone, WhatsApp, etc.) — it lets them set a new password. It
            works once and expires after an hour.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-gray-900 px-2 py-1 text-xs text-gray-200">{state.link}</code>
            <button type="button" onClick={copyLink} className="text-amber-400 hover:underline">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
