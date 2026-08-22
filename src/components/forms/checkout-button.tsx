"use client";

import { useActionState } from "react";
import { startSubscriptionCheckout } from "@/server/actions/billing";
import { FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function CheckoutButton({ planId, label }: { planId: string; label: string }) {
  const [state, formAction, isPending] = useActionState(startSubscriptionCheckout, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="planId" value={planId} />
      <Button type="submit" isPending={isPending} pendingLabel="Redirecting…">
        {label}
      </Button>
      <FormError error={state.error} />
    </form>
  );
}
