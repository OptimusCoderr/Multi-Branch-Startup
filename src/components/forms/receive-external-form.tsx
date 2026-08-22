"use client";

import { useActionState, useMemo, useState } from "react";
import { receiveExternalStock } from "@/server/actions/transfers";
import { Field, Input, Select, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function ReceiveExternalForm({
  products,
  warehouses,
  branches,
}: {
  products: { id: string; name: string; sku: string; tracksBatches: boolean }[];
  warehouses: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(receiveExternalStock, initialState);
  const [productId, setProductId] = useState("");

  const canReceiveAtWarehouse = warehouses.length > 0;
  const canReceiveAtBranch = branches.length > 0;
  const [destinationType, setDestinationType] = useState<"WAREHOUSE" | "BRANCH">(canReceiveAtWarehouse ? "WAREHOUSE" : "BRANCH");
  const showDestinationTypePicker = canReceiveAtWarehouse && canReceiveAtBranch;

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const requiresBatch = selectedProduct?.tracksBatches ?? false;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Product">
        <Select name="productId" required value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
              {p.tracksBatches ? " — batch tracked" : ""}
            </option>
          ))}
        </Select>
      </Field>

      {showDestinationTypePicker && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-0.5 text-gray-500">Receiving location</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="destinationType"
                value="WAREHOUSE"
                checked={destinationType === "WAREHOUSE"}
                onChange={() => setDestinationType("WAREHOUSE")}
              />
              A warehouse
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="destinationType"
                value="BRANCH"
                checked={destinationType === "BRANCH"}
                onChange={() => setDestinationType("BRANCH")}
              />
              A branch
            </label>
          </div>
        </fieldset>
      )}
      {!showDestinationTypePicker && <input type="hidden" name="destinationType" value={destinationType} />}

      {destinationType === "WAREHOUSE" ? (
        <Field label="Receiving warehouse">
          <Select name="destinationWarehouseId" required>
            <option value="">Select a warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Receiving branch">
          <Select name="destinationBranchId" required>
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Quantity">
        <Input name="quantity" type="number" min="1" step="1" required />
      </Field>

      <Field label="Supplier / source">
        <Input name="externalSourceName" required />
      </Field>

      {requiresBatch && (
        <Card variant="warning">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium text-amber-800">
              This product is perishable / batch-tracked — batch details are required for this delivery.
            </p>
            <Field label="Batch number">
              <Input name="batchNumber" required={requiresBatch} className="font-mono text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Manufacture date" optional>
                <Input name="manufactureDate" type="date" />
              </Field>
              <Field label="Expiry date">
                <Input name="expiryDate" type="date" required={requiresBatch} />
              </Field>
            </div>
          </div>
        </Card>
      )}

      <Field label="Notes" optional>
        <Input name="notes" />
      </Field>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Recording…">
        Record delivery
      </Button>
    </form>
  );
}
