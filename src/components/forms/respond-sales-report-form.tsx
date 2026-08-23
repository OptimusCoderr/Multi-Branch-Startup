"use client";

import { useActionState, useState } from "react";
import { respondToDailySalesReport } from "@/server/actions/sales-reports";
import { Field, Textarea, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

/**
 * Three submit buttons in one form, each carrying its own `name="action"
 * value="..."` — the browser includes whichever button was actually
 * clicked in the FormData natively, so which action fires never depends on
 * React state having re-rendered before the native form submission reads
 * the DOM (a real race if this were done via a shared hidden input updated
 * from an onClick handler instead). `lastClicked` is purely cosmetic, for
 * showing the right pending label on the right button.
 */
export function RespondSalesReportForm({ reportId }: { reportId: string }) {
  const [state, formAction, isPending] = useActionState(respondToDailySalesReport.bind(null, reportId), initialState);
  const [lastClicked, setLastClicked] = useState<"APPROVE" | "SEND_BACK" | "REJECT" | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Note" optional hint="Required if you send this back — tell the staff what to fix.">
        <Textarea name="note" rows={3} />
      </Field>

      <FormError error={state.error} />

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="action"
          value="APPROVE"
          onClick={() => setLastClicked("APPROVE")}
          isPending={isPending && lastClicked === "APPROVE"}
          pendingLabel="Approving…"
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="action"
          value="SEND_BACK"
          variant="secondary"
          onClick={() => setLastClicked("SEND_BACK")}
          isPending={isPending && lastClicked === "SEND_BACK"}
          pendingLabel="Sending back…"
        >
          Send back
        </Button>
        <Button
          type="submit"
          name="action"
          value="REJECT"
          variant="danger"
          onClick={() => setLastClicked("REJECT")}
          isPending={isPending && lastClicked === "REJECT"}
          pendingLabel="Rejecting…"
        >
          Reject
        </Button>
      </div>
    </form>
  );
}
