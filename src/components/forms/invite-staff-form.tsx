"use client";

import { useActionState, useState } from "react";
import { inviteStaff } from "@/server/actions/staff";
import { Field, Input, Select, FormError, Button, Card } from "@/components/ui";

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
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <Field label="Email">
          <Input name="email" type="email" required />
        </Field>
        <Field label="Role">
          <Select name="roleId" required>
            <option value="">Select a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" isPending={isPending} pendingLabel="Inviting…">
          Send invite
        </Button>
      </form>

      <FormError error={state.error} />

      {state.inviteUrl && (
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <p className="text-gray-500">
            No email provider is configured yet — share this link with the invitee directly:
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">{state.inviteUrl}</code>
            <Button type="button" variant="link" onClick={copyLink}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
