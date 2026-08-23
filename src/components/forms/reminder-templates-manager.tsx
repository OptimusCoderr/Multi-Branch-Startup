"use client";

import { useActionState, useState } from "react";
import {
  createReminderTemplate,
  updateReminderTemplate,
  setDefaultReminderTemplate,
  deleteReminderTemplate,
} from "@/server/actions/debt-reminder-templates";
import { Field, Input, Textarea, Checkbox, FormError, Button, Card, Badge } from "@/components/ui";

type Template = { id: string; name: string; message: string; isDefault: boolean };
type FormState = { error: string };
const initialState: FormState = { error: "" };

const PLACEHOLDER_HINT = "Placeholders: {name}, {company}, {amount}, {currency}, {pay_link}";

function TemplateRow({ template }: { template: Template }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateReminderTemplate.bind(null, template.id), initialState);

  if (!editing) {
    return (
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-gray-100">{template.name}</p>
            {template.isDefault && <Badge variant="brand">Default</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="link" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {!template.isDefault && (
              <form action={setDefaultReminderTemplate.bind(null, template.id)}>
                <Button type="submit" variant="link">
                  Set as default
                </Button>
              </form>
            )}
            <form action={deleteReminderTemplate.bind(null, template.id)}>
              <Button type="submit" variant="danger-link">
                Delete
              </Button>
            </form>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm text-gray-500 dark:text-gray-400">{template.message}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Field label="Name">
          <Input name="name" defaultValue={template.name} required />
        </Field>
        <Field label="Message" hint={PLACEHOLDER_HINT}>
          <Textarea name="message" defaultValue={template.message} rows={3} required />
        </Field>
        <Checkbox name="isDefault" defaultChecked={template.isDefault} label="Use as the default template" />
        <FormError error={state.error} />
        <div className="flex gap-3">
          <Button type="submit" isPending={isPending} pendingLabel="Saving…" size="sm">
            Save
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NewTemplateForm() {
  const [state, formAction, isPending] = useActionState(createReminderTemplate, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add a message template</p>
      <form action={formAction} className="flex flex-col gap-3">
        <Field label="Name" hint="A label for staff, e.g. &ldquo;Friendly nudge&rdquo; or &ldquo;Final notice&rdquo;.">
          <Input name="name" required />
        </Field>
        <Field label="Message" hint={PLACEHOLDER_HINT}>
          <Textarea
            name="message"
            rows={3}
            required
            placeholder="Hi {name}, this is a reminder from {company} that you have an outstanding balance of {currency} {amount}. Pay now: {pay_link}"
          />
        </Field>
        <Checkbox name="isDefault" label="Use as the default template (for customers with no template of their own)" />
        <FormError error={state.error} />
        <Button type="submit" isPending={isPending} pendingLabel="Adding…" size="sm" className="self-start">
          Add template
        </Button>
      </form>
    </Card>
  );
}

export function ReminderTemplatesManager({ templates }: { templates: Template[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Message templates</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Reusable reminder wordings — assign one to a customer from their profile, or leave them on the default.
          {templates.length === 0 && " With none set up, reminders use a built-in default message."}
        </p>
      </div>
      {templates.map((t) => (
        <TemplateRow key={t.id} template={t} />
      ))}
      <NewTemplateForm />
    </div>
  );
}
