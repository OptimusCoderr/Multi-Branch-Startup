"use client";

import { useActionState, useState } from "react";
import { promotePlatformStaff } from "@/server/actions/platform-admin";

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
    <div className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="w-64 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Role
          <select name="role" defaultValue="SUPPORT_AGENT" className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100">
            <option value="SUPPORT_AGENT">Support agent</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add to platform team"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      {state.password && (
        <div className="rounded-md bg-gray-950 p-3 text-sm">
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
    </div>
  );
}
