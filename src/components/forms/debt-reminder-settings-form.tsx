"use client";

import { useActionState } from "react";
import { updateDebtReminderSettings } from "@/server/actions/debt-reminder-settings";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function DebtReminderSettingsForm({
  defaultValues,
  smsConfigured,
}: {
  defaultValues: { debtReminderEnabled: boolean; debtReminderDaysOverdue: number };
  smsConfigured: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateDebtReminderSettings, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      {!smsConfigured && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          SMS is not configured in this environment yet — reminders can be enabled here, but sending will fail until a
          real Termii API key is set.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="debtReminderEnabled" defaultChecked={defaultValues.debtReminderEnabled} />
        Automatically remind customers by SMS when their balance is overdue
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Remind after this many days overdue
        <input
          name="debtReminderDaysOverdue"
          type="number"
          min="1"
          max="365"
          defaultValue={defaultValues.debtReminderDaysOverdue}
          className="w-32 rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <p className="text-xs text-gray-400">
        A customer is never reminded more than once every 3 days, and can opt out individually from their customer
        page. This runs automatically once a day when deployed; from the customers page, staff with permission can
        also send reminders on demand.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
