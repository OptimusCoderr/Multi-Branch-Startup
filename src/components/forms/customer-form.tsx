"use client";

import { useActionState, useState } from "react";
import { Field, Input, Textarea, Select, Checkbox, FormError, Button } from "@/components/ui";

type CustomerFormState = { error: string };
const initialState: CustomerFormState = { error: "" };
type Template = { id: string; name: string; isDefault: boolean };

export function CustomerForm({
  action,
  defaultValues,
  templates = [],
  submitLabel,
}: {
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  defaultValues?: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    creditLimit: string | null;
    remindersEnabled: boolean;
    reminderTemplateId: string | null;
  };
  templates?: Template[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [remindersEnabled, setRemindersEnabled] = useState(defaultValues?.remindersEnabled ?? true);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={defaultValues?.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" hint={remindersEnabled ? "Required while automated reminders are on." : undefined}>
          <Input name="phone" defaultValue={defaultValues?.phone ?? ""} required={remindersEnabled} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        </Field>
      </div>

      <Field label="Address">
        <Input name="address" defaultValue={defaultValues?.address ?? ""} />
      </Field>

      <Field label="Credit limit" optional>
        <Input name="creditLimit" type="number" step="0.01" min="0" defaultValue={defaultValues?.creditLimit ?? ""} />
      </Field>

      <Field label="Notes">
        <Textarea name="notes" defaultValue={defaultValues?.notes ?? ""} rows={3} />
      </Field>

      <Checkbox
        name="remindersEnabled"
        checked={remindersEnabled}
        onChange={(e) => setRemindersEnabled(e.target.checked)}
        label="Allow automated payment reminders to this customer"
      />

      {remindersEnabled && (
        <Field label="Message template" optional hint="Leave blank to use the company's default template.">
          <Select name="reminderTemplateId" defaultValue={defaultValues?.reminderTemplateId ?? ""}>
            <option value="">Use company default</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " (default)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Saving…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
