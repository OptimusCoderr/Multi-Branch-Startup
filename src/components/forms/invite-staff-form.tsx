"use client";

import { useActionState, useState } from "react";
import { inviteStaff } from "@/server/actions/staff";

type FormState = { error: string; inviteUrl?: string };
const initialState: FormState = { error: "" };

export function InviteStaffForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(inviteStaff, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Role
          <select name="roleId" required className="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Select a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Inviting…" : "Send invite"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.inviteUrl && (
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <p className="text-gray-500">
            No email provider is configured yet — share this link with the invitee directly:
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">{state.inviteUrl}</code>
            <button type="button" onClick={copyLink} className="text-[var(--brand-primary)] hover:underline">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
