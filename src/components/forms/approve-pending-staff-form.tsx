"use client";

import { useActionState } from "react";
import { approvePendingStaff, rejectPendingStaff } from "@/server/actions/staff";
import { Field, Select, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ApprovePendingStaffForm({
  membershipId,
  roles,
}: {
  membershipId: string;
  roles: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(approvePendingStaff.bind(null, membershipId), initialState);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <Field label="Assign role">
            <Select name="roleId" required defaultValue="">
              <option value="" disabled>
                Select a role
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary" size="sm" isPending={isPending} pendingLabel="Approving…">
            Approve
          </Button>
        </form>
        <form action={rejectPendingStaff.bind(null, membershipId)}>
          <Button type="submit" variant="danger-link" size="sm">
            Reject
          </Button>
        </form>
      </div>
      <FormError error={state.error} />
    </div>
  );
}
