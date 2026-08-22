import { notFound } from "next/navigation";
import Image from "next/image";
import { requireMembership } from "@/lib/auth/session";
import { getScopedPrisma, Prisma } from "@/lib/db/scoped-prisma";
import { formatMoney } from "@/lib/format";
import { getBrandingSettings } from "@/lib/branding";
import { PrintButton } from "@/components/print-button";

export default async function SaleInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const [sale, branding] = await Promise.all([
    db.sale.findUnique({
      where: { id },
      include: {
        branch: true,
        lineItems: { include: { product: true } },
        payments: { orderBy: { paidAt: "asc" } },
        creditNotes: { where: { status: "ISSUED" } },
      },
    }),
    getBrandingSettings(membership.companyId),
  ]);
  if (!sale) notFound();

  const creditedTotal = sale.creditNotes.reduce((sum, cn) => sum.add(cn.amount), new Prisma.Decimal(0));
  const outstanding = sale.grandTotal.sub(sale.amountPaid).sub(creditedTotal);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Invoice preview</h1>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            {branding.logoUrl && (
              <Image src={branding.logoUrl} alt="" width={32} height={32} unoptimized className="rounded" />
            )}
            <p className="text-lg font-semibold">{membership.companyName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">INVOICE</p>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{sale.saleNumber}</p>
          </div>
        </div>

        <div className="mt-4 flex justify-between text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Bill to</p>
            <p>{sale.customerName ?? "Walk-in customer"}</p>
            {sale.customerPhone && <p className="text-gray-500 dark:text-gray-400">{sale.customerPhone}</p>}
            {sale.customerEmail && <p className="text-gray-500 dark:text-gray-400">{sale.customerEmail}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Details</p>
            <p>{sale.branch.name}</p>
            <p className="text-gray-500 dark:text-gray-400">{sale.createdAt.toLocaleDateString()}</p>
            {sale.dueDate && <p className="text-gray-500 dark:text-gray-400">Due {sale.dueDate.toLocaleDateString()}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
              <th className="pb-2">Item</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Unit price</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2">{li.product.name}</td>
                <td className="py-2">{li.quantity}</td>
                <td className="py-2">{formatMoney(li.unitPriceAtSale.toString(), currency)}</td>
                <td className="py-2 text-right">{formatMoney(li.lineTotal.toString(), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <p>Subtotal: {formatMoney(sale.subtotal.toString(), currency)}</p>
          <p className="text-base font-semibold">Grand total: {formatMoney(sale.grandTotal.toString(), currency)}</p>
          <p>Paid: {formatMoney(sale.amountPaid.toString(), currency)}</p>
          {creditedTotal.gt(0) && <p>Credited: {formatMoney(creditedTotal.toString(), currency)}</p>}
          {outstanding.gt(0) && sale.status !== "VOIDED" && (
            <p className="font-semibold text-amber-700 dark:text-amber-400">Balance due: {formatMoney(outstanding.toString(), currency)}</p>
          )}
        </div>

        {sale.status === "VOIDED" && (
          <p className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-4 text-center text-sm font-semibold text-red-600 dark:text-red-400">
            THIS SALE HAS BEEN VOIDED — {sale.voidReason}
          </p>
        )}

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">Thank you for your business.</p>
      </div>
    </div>
  );
}
