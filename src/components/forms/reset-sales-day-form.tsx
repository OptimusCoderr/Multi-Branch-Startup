"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { resetSalesDay } from "@/server/actions/dashboard-admin";
import { Modal, Field, Input, FormError, Button } from "@/components/ui";

type FormState = { error: string; voidedCount?: number; skippedPaidCount?: number };
const initialState: FormState = { error: "" };

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Owner-only, typed "RESET" confirmation daily-sales wipe — see
 * sale-reset-service.ts for why this only ever voids *unpaid* sales for
 * the chosen day rather than every sale.
 */
export function ResetSalesDayForm() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, isPending] = useActionState(resetSalesDay, initialState);

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw size={14} />
        Reset data
      </Button>

      {open && (
        <Modal title="Reset a day's sales data" onClose={close} size="sm" closeOnBackdrop={!isPending}>
          {state.voidedCount !== undefined ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Voided <strong>{state.voidedCount}</strong> unpaid sale(s) for {date}
                {state.skippedPaidCount ? (
                  <>
                    {" "}
                    — <strong>{state.skippedPaidCount}</strong> already-paid sale(s) were left untouched. Use a credit note to correct
                    those individually.
                  </>
                ) : (
                  "."
                )}
              </p>
              <Button variant="secondary" size="sm" onClick={close} className="self-end">
                Done
              </Button>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  This permanently voids every <strong>unpaid</strong> sale recorded on the chosen day and restores the stock they used.
                  Sales that already have a payment recorded are never touched — void those individually via a credit note. This cannot
                  be undone.
                </p>
              </div>

              <Field label="Day to reset">
                <Input type="date" name="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
              </Field>

              <Field label='Type "RESET" to confirm'>
                <Input
                  name="confirmText"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>

              <FormError error={state.error} />

              <Button
                type="submit"
                variant="danger"
                isPending={isPending}
                pendingLabel="Resetting…"
                disabled={confirmText !== "RESET"}
                className="self-end"
              >
                Reset day
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
