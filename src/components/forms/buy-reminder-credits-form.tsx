"use client";

import { useActionState, useState } from "react";
import { startCreditPurchase } from "@/server/actions/reminder-credits";
import { formatMoney } from "@/lib/format";
import { FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

const PACKS = [
  { id: "pack_50", credits: 50, priceKobo: 250_000 },
  { id: "pack_200", credits: 200, priceKobo: 800_000 },
  { id: "pack_500", credits: 500, priceKobo: 1_500_000 },
] as const;

export function BuyReminderCreditsForm({ currency }: { currency: string }) {
  const [state, formAction, isPending] = useActionState(startCreditPurchase, initialState);
  const [packId, setPackId] = useState<(typeof PACKS)[number]["id"]>("pack_200");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="packId" value={packId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setPackId(pack.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              packId === pack.id
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{pack.credits} credits</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatMoney(pack.priceKobo / 100, currency)}</p>
          </button>
        ))}
      </div>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Redirecting…" className="self-start">
        Buy credits
      </Button>
    </form>
  );
}
