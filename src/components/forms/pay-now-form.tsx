"use client";

import { useActionState } from "react";
import { startDebtorPaymentAction } from "@/server/actions/public-payment";
import { FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function PayNowForm({ saleId }: { saleId: string }) {
  const [state, formAction, isPending] = useActionState(startDebtorPaymentAction.bind(null, saleId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError error={state.error} />
      <Button type="submit" isPending={isPending} pendingLabel="Redirecting to secure checkout…" className="w-full justify-center">
        Pay now
      </Button>
    </form>
  );
}
