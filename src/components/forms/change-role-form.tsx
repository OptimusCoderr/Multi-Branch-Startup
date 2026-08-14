"use client";

import { useActionState } from "react";
import { updateStaffRole } from "@/server/actions/staff";

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
      <label className="flex flex-col gap-1 text-sm">
        Role
        <select name="roleId" defaultValue={currentRoleId ?? ""} required className="rounded-md border border-gray-300 px-3 py-2">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Change role"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
