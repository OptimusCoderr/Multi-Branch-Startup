"use client";

import { useActionState, useMemo, useState } from "react";
import { createSale } from "@/server/actions/sales";
import { formatMoney } from "@/lib/format";
import { Field, Input, Select, Checkbox, FormError, Button } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

type Product = { id: string; name: string; sku: string; unitPrice: string };
type Customer = { id: string; name: string; phone: string | null };

export function CreateSaleForm({
  branches,
  products,
  customers,
  currency,
}: {
  branches: { id: string; name: string }[];
  products: Product[];
  customers: Customer[];
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState(createSale, initialState);
  const [rows, setRows] = useState<{ productId: string; quantity: number }[]>([{ productId: "", quantity: 1 }]);
  const [customerId, setCustomerId] = useState("");
  const [isCredit, setIsCredit] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = rows.reduce((sum, row) => {
    const product = productById.get(row.productId);
    if (!product || row.quantity <= 0) return sum;
    return sum + Number(product.unitPrice) * row.quantity;
  }, 0);

  function updateRow(index: number, patch: Partial<{ productId: string; quantity: number }>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const validLineItems = rows.filter((r) => r.productId && r.quantity > 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lineItems" value={JSON.stringify(validLineItems)} />

      <Field label="Branch">
        <Select name="branchId" required>
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Customer">
        <Select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in / new customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.phone ? `(${c.phone})` : ""}
            </option>
          ))}
        </Select>
      </Field>

      {!customerId && (
        <div className="grid grid-cols-3 gap-4">
          <Field label="Customer name">
            <Input name="customerName" />
          </Field>
          <Field label="Phone">
            <Input name="customerPhone" />
          </Field>
          <Field label="Email">
            <Input name="customerEmail" type="email" />
          </Field>
        </div>
      )}

      <Checkbox
        checked={isCredit}
        onChange={(e) => setIsCredit(e.target.checked)}
        label="This is a credit sale (set a payment due date)"
      />

      {isCredit && (
        <Field label="Payment due date">
          <Input name="dueDate" type="date" className="w-48" />
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Line items</p>
        {rows.map((row, i) => {
          const product = productById.get(row.productId);
          return (
            <div key={i} className="flex items-center gap-2">
              <Select value={row.productId} onChange={(e) => updateRow(i, { productId: e.target.value })} className="flex-1">
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {formatMoney(p.unitPrice, currency)}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                className="w-24"
              />
              <span className="w-28 text-right text-sm text-gray-500 dark:text-gray-400">
                {product ? formatMoney(Number(product.unitPrice) * row.quantity, currency) : "—"}
              </span>
              <Button type="button" variant="danger-link" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                Remove
              </Button>
            </div>
          );
        })}
        <Button type="button" variant="link" onClick={addRow} className="self-start">
          + Add product
        </Button>
      </div>

      <div className="flex justify-end text-lg font-semibold">Total: {formatMoney(total, currency)}</div>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Recording…" disabled={validLineItems.length === 0}>
        Record sale
      </Button>
    </form>
  );
}
