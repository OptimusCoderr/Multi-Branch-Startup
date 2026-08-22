"use client";

import { useActionState } from "react";
import { updateStaffRole } from "@/server/actions/staff";
import { Field, Select, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ChangeRoleForm({
  membershipId,
  roles,
  currentRoleId,
}: {
  membershipId: string;
  roles: { id: string; name: string }[];
  currentRoleId: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateStaffRole.bind(null, membershipId), initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <Field label="Role">
        <Select name="roleId" defaultValue={currentRoleId ?? ""} required>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary" size="sm" isPending={isPending} pendingLabel="Saving…">
        Change role
      </Button>
      <FormError error={state.error} />
    </form>
  );
}
