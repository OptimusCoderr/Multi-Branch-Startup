"use client";

import { useActionState } from "react";
import { sendDebtRemindersNow } from "@/server/actions/debt-reminders";
import { Button } from "@/components/ui";

type SendResult = { error: string; summary?: string };
const initialState: SendResult = { error: "" };

export function SendRemindersButton() {
  const [state, formAction, isPending] = useActionState(sendDebtRemindersNow, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="secondary" size="sm" isPending={isPending} pendingLabel="Sending…">
        Send reminders now
      </Button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.summary && <span className="text-sm text-gray-500">{state.summary}</span>}
    </form>
  );
}
