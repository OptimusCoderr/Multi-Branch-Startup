"use client";

import { useActionState, useMemo, useState } from "react";
import { createSale } from "@/server/actions/sales";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Field, Input, Select, Checkbox, FormError, Button, Badge } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

type Product = { id: string; name: string; sku: string; unitPrice: string; unitLabel: string };
type Customer = { id: string; name: string; phone: string | null };

type Row =
  | { kind: "product"; productId: string; quantity: number }
  | { kind: "service"; description: string; unitPrice: string; quantity: number };

const emptyProductRow: Row = { kind: "product", productId: "", quantity: 1 };
const emptyServiceRow: Row = { kind: "service", description: "", unitPrice: "", quantity: 1 };

function rowTotal(row: Row, productById: Map<string, Product>): number {
  if (row.kind === "product") {
    const product = productById.get(row.productId);
    if (!product || row.quantity <= 0) return 0;
    return Number(product.unitPrice) * row.quantity;
  }
  const price = Number(row.unitPrice);
  if (!row.description.trim() || !price || price <= 0 || row.quantity <= 0) return 0;
  return price * row.quantity;
}

function isRowValid(row: Row): boolean {
  if (row.kind === "product") return Boolean(row.productId) && row.quantity > 0;
  return Boolean(row.description.trim()) && Number(row.unitPrice) > 0 && row.quantity > 0;
}

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
  const [rows, setRows] = useState<Row[]>([emptyProductRow]);
  const [customerId, setCustomerId] = useState("");
  const [isCredit, setIsCredit] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = rows.reduce((sum, row) => sum + rowTotal(row, productById), 0);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? ({ ...row, ...patch } as Row) : row)));
  }

  function addProductRow() {
    setRows((prev) => [...prev, { ...emptyProductRow }]);
  }

  function addServiceRow() {
    setRows((prev) => [...prev, { ...emptyServiceRow }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const validRows = rows.filter(isRowValid);
  const lineItemsPayload = validRows.map((row) =>
    row.kind === "product"
      ? { productId: row.productId, quantity: row.quantity }
      : { description: row.description.trim(), unitPrice: Number(row.unitPrice), quantity: row.quantity },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lineItems" value={JSON.stringify(lineItemsPayload)} />

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
          if (row.kind === "product") {
            const product = productById.get(row.productId);
            return (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={row.productId}
                  onChange={(e) => updateRow(i, { productId: e.target.value })}
                  className="flex-1"
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {formatMoney(p.unitPrice, currency)} / {p.unitLabel}
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
                {product && (
                  <span className="w-20 text-xs text-gray-400 dark:text-gray-500">{formatQuantity(row.quantity, product.unitLabel)}</span>
                )}
                <span className="w-28 text-right text-sm text-gray-500 dark:text-gray-400">
                  {product ? formatMoney(Number(product.unitPrice) * row.quantity, currency) : "—"}
                </span>
                <Button type="button" variant="danger-link" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                  Remove
                </Button>
              </div>
            );
          }

          return (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5">
              <Badge variant="brand">Service</Badge>
              <Input
                placeholder="Description (e.g. Installation, Repair)"
                value={row.description}
                onChange={(e) => updateRow(i, { description: e.target.value })}
                className="flex-1"
              />
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Price"
                value={row.unitPrice}
                onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                className="w-28"
              />
              <Input
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                className="w-20"
              />
              <span className="w-28 text-right text-sm text-gray-500 dark:text-gray-400">
                {formatMoney(rowTotal(row, productById), currency)}
              </span>
              <Button type="button" variant="danger-link" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                Remove
              </Button>
            </div>
          );
        })}
        <div className="flex gap-4">
          <Button type="button" variant="link" onClick={addProductRow} className="self-start">
            + Add product
          </Button>
          <Button type="button" variant="link" onClick={addServiceRow} className="self-start">
            + Add service
          </Button>
        </div>
      </div>

      <div className="flex justify-end text-lg font-semibold">Total: {formatMoney(total, currency)}</div>

      <FormError error={state.error} />

      <Button type="submit" isPending={isPending} pendingLabel="Recording…" disabled={validRows.length === 0}>
        Record sale
      </Button>
    </form>
  );
}
