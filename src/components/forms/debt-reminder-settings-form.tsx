"use client";

import { useActionState } from "react";
import { updateDebtReminderSettings } from "@/server/actions/debt-reminder-settings";
import { Field, Input, Checkbox, FormError, Button, Card } from "@/components/ui";

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
        <Card variant="warning">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            SMS is not configured in this environment yet — reminders can be enabled here, but sending will fail
            until a real Termii API key is set.
          </p>
        </Card>
      )}

      <Checkbox
        name="debtReminderEnabled"
        defaultChecked={defaultValues.debtReminderEnabled}
        label="Automatically remind customers by SMS when their balance is overdue"
      />

      <Field label="Remind after this many days overdue">
        <Input
          name="debtReminderDaysOverdue"
          type="number"
          min="1"
          max="365"
          defaultValue={defaultValues.debtReminderDaysOverdue}
          className="w-32"
        />
      </Field>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        A customer is never reminded more than once every 3 days, and can opt out individually from their customer
        page. This runs automatically once a day when deployed; from the customers page, staff with permission can
        also send reminders on demand.
      </p>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        Save settings
      </Button>
    </form>
  );
}
