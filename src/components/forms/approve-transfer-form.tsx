"use client";

import { useActionState, useEffect, useState } from "react";
import { approveTransfer } from "@/server/actions/transfers";
import { Field, Input, Select, FormError, Button } from "@/components/ui";

type FormState = { error: string; success?: boolean };
const initialState: FormState = { error: "" };

export function ApproveTransferForm({
  transferId,
  warehouses,
  branches,
  requiresBatch,
  onSuccess,
}: {
  transferId: string;
  warehouses: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  requiresBatch: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(approveTransfer.bind(null, transferId), initialState);
  const [sourceType, setSourceType] = useState<"WAREHOUSE" | "BRANCH" | "EXTERNAL">(
    warehouses.length > 0 ? "WAREHOUSE" : branches.length > 0 ? "BRANCH" : "EXTERNAL",
  );

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fire when the action reports a fresh success
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <p className="text-sm font-medium">Approve — where is this stock coming from?</p>

      <fieldset className="flex flex-col gap-1.5 text-sm">
        <div className="flex flex-wrap gap-4">
          {warehouses.length > 0 && (
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="sourceType"
                value="WAREHOUSE"
                checked={sourceType === "WAREHOUSE"}
                onChange={() => setSourceType("WAREHOUSE")}
              />
              A warehouse
            </label>
          )}
          {branches.length > 0 && (
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="sourceType"
                value="BRANCH"
                checked={sourceType === "BRANCH"}
                onChange={() => setSourceType("BRANCH")}
              />
              Another branch
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="sourceType"
              value="EXTERNAL"
              checked={sourceType === "EXTERNAL"}
              onChange={() => setSourceType("EXTERNAL")}
            />
            An external supplier
          </label>
        </div>
      </fieldset>

      {sourceType === "WAREHOUSE" && (
        <Field label="Source warehouse">
          <Select name="sourceWarehouseId" required>
            <option value="">Select a warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {sourceType === "BRANCH" && (
        <Field label="Source branch">
          <Select name="sourceBranchId" required>
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {sourceType === "EXTERNAL" && (
        <>
          <Field label="Supplier / source">
            <Input name="externalSourceName" required />
          </Field>
          {requiresBatch && (
            <>
              <Field label="Batch number">
                <Input name="batchNumber" required className="font-mono text-sm" />
              </Field>
              <Field label="Manufacture date" optional>
                <Input name="manufactureDate" type="date" />
              </Field>
              <Field label="Expiry date">
                <Input name="expiryDate" type="date" required />
              </Field>
            </>
          )}
        </>
      )}

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Approving…" className="self-start">
        Approve
      </Button>
    </form>
  );
}
