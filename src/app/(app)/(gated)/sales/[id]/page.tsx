import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma, Prisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { formatMoney } from "@/lib/format";
import { RecordPaymentForm } from "@/components/forms/record-payment-form";
import { VoidSaleForm } from "@/components/forms/void-sale-form";
import { IssueCreditNoteForm } from "@/components/forms/issue-credit-note-form";
import { VoidCreditNoteForm } from "@/components/forms/void-credit-note-form";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-yellow-100 text-yellow-700",
  PARTIALLY_PAID: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  VOIDED: "bg-gray-100 text-gray-500",
};

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      branch: true,
      lineItems: { include: { product: true } },
      payments: { orderBy: { paidAt: "asc" } },
      creditNotes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) notFound();

  const names = await resolveMembershipNames(db, [
    sale.soldByMembershipId,
    sale.voidedByMembershipId,
    ...sale.payments.map((p) => p.recordedByMembershipId),
    ...sale.creditNotes.flatMap((cn) => [cn.issuedByMembershipId, cn.voidedByMembershipId]),
  ]);
  const nameOf = (mid: string | null) => (mid ? (names.get(mid) ?? "Unknown") : null);

  const canRecordPayment = permissions.has(PERMISSIONS.PAYMENTS_RECORD);
  const canVoid = permissions.has(PERMISSIONS.SALES_VOID);
  const canIssueCreditNote = permissions.has(PERMISSIONS.CREDIT_NOTES_ISSUE);
  const canVoidCreditNote = permissions.has(PERMISSIONS.CREDIT_NOTES_VOID);

  const creditedTotal = sale.creditNotes
    .filter((cn) => cn.status === "ISSUED")
    .reduce((sum, cn) => sum.add(cn.amount), new Prisma.Decimal(0));
  const outstanding = sale.grandTotal.sub(sale.amountPaid).sub(creditedTotal);
  const canPay = sale.status !== "VOIDED" && sale.status !== "PAID" && outstanding.gt(0);
  const canCreditNote = sale.status !== "VOIDED" && outstanding.gt(0);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{sale.saleNumber}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[sale.status] ?? ""}`}>
              {sale.status.replace("_", " ")}
            </span>
          </div>
          <Link href={`/sales/${sale.id}/print`} className="text-sm text-[var(--brand-primary)] hover:underline">
            Print invoice
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {sale.branch.name} · Sold by {nameOf(sale.soldByMembershipId)} · {sale.createdAt.toLocaleString()}
        </p>
        {sale.customerName && (
          <p className="mt-1 text-sm text-gray-500">
            Customer: {sale.customerName} {sale.customerPhone ? `· ${sale.customerPhone}` : ""}
          </p>
        )}
        {sale.status === "VOIDED" && (
          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Voided by {nameOf(sale.voidedByMembershipId)} on {sale.voidedAt?.toLocaleString()} — {sale.voidReason}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Line items</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500">
              <th className="pb-1">Product</th>
              <th className="pb-1">Qty</th>
              <th className="pb-1">Unit price</th>
              <th className="pb-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.lineItems.map((li) => (
              <tr key={li.id}>
                <td className="py-1">{li.product.name}</td>
                <td className="py-1">{li.quantity}</td>
                <td className="py-1">{formatMoney(li.unitPriceAtSale.toString(), currency)}</td>
                <td className="py-1 text-right">{formatMoney(li.lineTotal.toString(), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-col items-end gap-1 text-sm">
          <p>Subtotal: {formatMoney(sale.subtotal.toString(), currency)}</p>
          <p className="font-semibold">Grand total: {formatMoney(sale.grandTotal.toString(), currency)}</p>
          <p>Paid: {formatMoney(sale.amountPaid.toString(), currency)}</p>
          {creditedTotal.gt(0) && <p>Credited: {formatMoney(creditedTotal.toString(), currency)}</p>}
          {outstanding.gt(0) && sale.status !== "VOIDED" && (
            <p className="font-medium text-amber-700">Outstanding: {formatMoney(outstanding.toString(), currency)}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Payments</p>
        {sale.payments.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sale.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {p.mode.replace("_", " ")} · {nameOf(p.recordedByMembershipId)} · {p.paidAt.toLocaleString()}
                </span>
                <span className="font-mono">{formatMoney(p.amount.toString(), currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canRecordPayment && canPay && (
        <RecordPaymentForm saleId={sale.id} outstanding={formatMoney(outstanding.toString(), currency)} />
      )}

      {canVoid && sale.status !== "VOIDED" && <VoidSaleForm saleId={sale.id} />}

      {sale.creditNotes.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Credit notes</p>
          <ul className="flex flex-col gap-2 text-sm">
            {sale.creditNotes.map((cn) => (
              <li key={cn.id} className="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{cn.creditNoteNumber}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn.status === "VOIDED" ? "text-gray-400 line-through" : "font-medium"}>
                      {formatMoney(cn.amount.toString(), currency)}
                    </span>
                    <Link href={`/credit-notes/${cn.id}/print`} className="text-xs text-[var(--brand-primary)] hover:underline">
                      Print
                    </Link>
                    {canVoidCreditNote && cn.status === "ISSUED" && <VoidCreditNoteForm saleId={sale.id} creditNoteId={cn.id} />}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {cn.reason} · Issued by {nameOf(cn.issuedByMembershipId)} · {cn.createdAt.toLocaleString()}
                </p>
                {cn.status === "VOIDED" && (
                  <p className="text-xs text-gray-400">
                    Voided by {nameOf(cn.voidedByMembershipId)} on {cn.voidedAt?.toLocaleString()} — {cn.voidReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canIssueCreditNote && canCreditNote && (
        <IssueCreditNoteForm saleId={sale.id} outstanding={formatMoney(outstanding.toString(), currency)} />
      )}
    </div>
  );
}
