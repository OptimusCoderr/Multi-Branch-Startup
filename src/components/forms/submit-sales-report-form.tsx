"use client";

import { useActionState, useMemo, useState } from "react";
import { submitDailySalesReport } from "@/server/actions/sales-reports";
import { formatMoney } from "@/lib/format";
import { Field, Input, Select, Textarea, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

type BranchPreview = {
  branchId: string;
  branchName: string;
  salesCount: number;
  grossSalesTotal: string;
  cashCollected: string;
  paymentsCollected: string;
};

export function SubmitSalesReportForm({ previews, currency }: { previews: BranchPreview[]; currency: string }) {
  const [state, formAction, isPending] = useActionState(submitDailySalesReport, initialState);
  const [branchId, setBranchId] = useState(previews[0]?.branchId ?? "");
  const [declaredCash, setDeclaredCash] = useState("");

  const preview = useMemo(() => previews.find((p) => p.branchId === branchId), [previews, branchId]);
  const discrepancy = preview && declaredCash !== "" ? Number(declaredCash) - Number(preview.cashCollected) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {previews.length > 1 ? (
        <Field label="Branch">
          <Select name="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            {previews.map((p) => (
              <option key={p.branchId} value={p.branchId}>
                {p.branchName}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="branchId" value={branchId} />
      )}

      {preview && (
        <Card>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Sales today</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{preview.salesCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Gross total</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(preview.grossSalesTotal, currency)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Payments collected</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(preview.paymentsCollected, currency)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Cash collected (system)</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{formatMoney(preview.cashCollected, currency)}</p>
            </div>
          </div>
        </Card>
      )}

      <Field
        label="Cash counted"
        optional
        hint="What you're handing over, if you're closing out a cash till. Compared against the system's cash total above."
      >
        <Input
          name="declaredCash"
          type="number"
          min="0"
          step="0.01"
          value={declaredCash}
          onChange={(e) => setDeclaredCash(e.target.value)}
        />
      </Field>

      {discrepancy !== null && Math.abs(discrepancy) > 0.01 && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          That&apos;s {formatMoney(Math.abs(discrepancy), currency)} {discrepancy > 0 ? "more" : "less"} than the system shows was
          collected in cash. This will be flagged for the Owner to review.
        </p>
      )}

      <Field label="Note" optional hint="Explain anything unusual — a discount, a discrepancy, a returned item.">
        <Textarea name="staffNote" rows={3} />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Submitting…" className="self-start">
        Submit report
      </Button>
    </form>
  );
}
