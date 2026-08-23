"use client";

import { useActionState, useMemo, useState } from "react";
import { createSale } from "@/server/actions/sales";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Field, Input, Select, FormError, Button, Badge } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

type Product = { id: string; name: string; sku: string; unitPrice: string; unitLabel: string };
type Customer = { id: string; name: string; phone: string | null };

type Row =
  | { kind: "product"; productId: string; quantity: number }
  | { kind: "service"; description: string; unitPrice: string; quantity: number };

type PaymentType = "POS" | "CASH" | "POS_CASH" | "PART_PAYMENT";

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  POS: "POS",
  CASH: "Cash",
  POS_CASH: "POS + Cash",
  PART_PAYMENT: "Part payment",
};

const PART_PAYMENT_MODES = ["CASH", "POS", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"] as const;

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
  const [paymentType, setPaymentType] = useState<PaymentType | "">("");
  const [posAmount, setPosAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [partAmountPaid, setPartAmountPaid] = useState("");
  const [partPaymentMode, setPartPaymentMode] = useState<string>("CASH");

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = rows.reduce((sum, row) => sum + rowTotal(row, productById), 0);
  const posCashTotal = Number(posAmount || 0) + Number(cashAmount || 0);
  const posCashMismatch = paymentType === "POS_CASH" && Math.abs(posCashTotal - total) > 0.009;

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

  const nameAndPhoneRequired = paymentType === "PART_PAYMENT" && !customerId;
  const canSubmit = validRows.length > 0 && Boolean(paymentType) && !posCashMismatch;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lineItems" value={JSON.stringify(lineItemsPayload)} />
      <input type="hidden" name="paymentType" value={paymentType} />

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
          <Field label="Customer name" optional={!nameAndPhoneRequired}>
            <Input
              name="customerName"
              required={nameAndPhoneRequired}
              placeholder={nameAndPhoneRequired ? undefined : "Leave blank to auto-generate"}
            />
          </Field>
          <Field label="Phone" optional={!nameAndPhoneRequired}>
            <Input name="customerPhone" required={nameAndPhoneRequired} />
          </Field>
          <Field label="Email" optional>
            <Input name="customerEmail" type="email" />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment type</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map((pt) => (
            <Button key={pt} type="button" variant={paymentType === pt ? "primary" : "secondary"} onClick={() => setPaymentType(pt)}>
              {PAYMENT_TYPE_LABELS[pt]}
            </Button>
          ))}
        </div>

        {paymentType === "POS_CASH" && (
          <div className="mt-1 flex flex-col gap-1">
            <div className="grid grid-cols-2 gap-4">
              <Field label="POS amount">
                <Input type="number" min="0" step="0.01" name="posAmount" value={posAmount} onChange={(e) => setPosAmount(e.target.value)} />
              </Field>
              <Field label="Cash amount">
                <Input type="number" min="0" step="0.01" name="cashAmount" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
              </Field>
            </div>
            <p className={`text-xs ${posCashMismatch ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
              POS + Cash must add up to {formatMoney(total, currency)} (currently {formatMoney(posCashTotal, currency)}).
            </p>
          </div>
        )}

        {paymentType === "PART_PAYMENT" && (
          <div className="mt-1 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount paying now" optional hint="Leave at 0 for a pure credit sale">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  name="partAmountPaid"
                  value={partAmountPaid}
                  onChange={(e) => setPartAmountPaid(e.target.value)}
                />
              </Field>
              <Field label="Payment mode">
                <Select name="partPaymentMode" value={partPaymentMode} onChange={(e) => setPartPaymentMode(e.target.value)}>
                  {PART_PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Payment due date">
              <Input name="dueDate" type="date" className="w-48" />
            </Field>
          </div>
        )}
      </div>

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

      <Button type="submit" isPending={isPending} pendingLabel="Recording…" disabled={!canSubmit}>
        Record sale
      </Button>
    </form>
  );
}
