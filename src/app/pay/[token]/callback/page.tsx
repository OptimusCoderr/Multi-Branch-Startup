import Link from "next/link";
import { verifyPaymentLinkToken } from "@/lib/auth/payment-link";
import * as debtorPaymentService from "@/server/services/debtor-payment-service";
import { formatMoney } from "@/lib/format";

async function confirm(saleId: string, reference: string): Promise<{ ok: boolean; title: string; detail?: string }> {
  try {
    const [{ amount, raceSettledElsewhere }, payable] = await Promise.all([
      debtorPaymentService.confirmDebtorPayment(reference, saleId),
      debtorPaymentService.getPayableSale(saleId),
    ]);
    const currency = payable?.currency ?? "NGN";

    if (raceSettledElsewhere) {
      return {
        ok: true,
        title: "Payment received",
        detail: "This balance was already settled just before your payment landed — the business has been notified and will sort out any difference.",
      };
    }
    return { ok: true, title: "Payment received", detail: `${formatMoney(amount.toString(), currency)} recorded.` };
  } catch (err) {
    return { ok: false, title: err instanceof Error ? err.message : "Payment could not be verified" };
  }
}

export default async function DebtorPaymentCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { token } = await params;
  const { reference, trxref } = await searchParams;
  const saleId = verifyPaymentLinkToken(token);
  const txReference = reference ?? trxref;

  const result =
    saleId && txReference ? await confirm(saleId, txReference) : { ok: false, title: "Missing payment details" };

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
      <h1 className={`text-xl font-semibold ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{result.title}</h1>
      {result.detail && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{result.detail}</p>}
      {saleId && (
        <Link href={`/pay/${token}`} className="text-sm text-[var(--brand-primary)] hover:underline">
          Back to payment page
        </Link>
      )}
    </div>
  );
}
