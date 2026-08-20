"use client";

import { useActionState } from "react";
import { sendDebtRemindersNow } from "@/server/actions/debt-reminders";

type SendResult = { error: string; summary?: string };
const initialState: SendResult = { error: "" };

export function SendRemindersButton() {
  const [state, formAction, isPending] = useActionState(sendDebtRemindersNow, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send reminders now"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.summary && <span className="text-sm text-gray-500">{state.summary}</span>}
    </form>
  );
}
