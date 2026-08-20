"use client";

import { useActionState, useState } from "react";
import { generatePasswordResetLink } from "@/server/actions/platform-admin";

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
    <div className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          User&apos;s email
          <input
            name="email"
            type="email"
            required
            className="w-72 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate reset link"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      {state.link && (
        <div className="rounded-md bg-gray-950 p-3 text-sm">
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
    </div>
  );
}
