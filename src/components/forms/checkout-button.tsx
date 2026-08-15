"use client";

import { useActionState } from "react";
import { startSubscriptionCheckout } from "@/server/actions/billing";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function CheckoutButton({ planId, label }: { planId: string; label: string }) {
  const [state, formAction, isPending] = useActionState(startSubscriptionCheckout, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="planId" value={planId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Redirecting…" : label}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
