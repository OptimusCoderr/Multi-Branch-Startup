"use client";

import { useActionState } from "react";
import { recordPayment } from "@/server/actions/sales";

type FormState = { error: string };
const initialState: FormState = { error: "" };

const PAYMENT_MODES = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"] as const;

export function RecordPaymentForm({ saleId, outstanding }: { saleId: string; outstanding: string }) {
  const [state, formAction, isPending] = useActionState(recordPayment.bind(null, saleId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">Outstanding balance: {outstanding}</p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Amount
          <input name="amount" type="number" step="0.01" min="0.01" required className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mode
          <select name="mode" required className="rounded-md border border-gray-300 px-3 py-2">
            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Reference (optional)
        <input name="reference" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
