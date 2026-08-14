"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/server/actions/staff";

const initialState = { error: "" };

export function AcceptInvitationButton({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(async () => {
    return (await acceptInvitation(token)) ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Joining…" : `Accept invitation as ${email}`}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
