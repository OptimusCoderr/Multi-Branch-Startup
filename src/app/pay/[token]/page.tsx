import Link from "next/link";
import { verifyPaymentLinkToken } from "@/lib/auth/payment-link";
import { getPayableSale } from "@/server/services/debtor-payment-service";
import { formatMoney } from "@/lib/format";
import { PayNowForm } from "@/components/forms/pay-now-form";
import { Card } from "@/components/ui";

export default async function DebtorPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const saleId = verifyPaymentLinkToken(token);
  const payable = saleId ? await getPayableSale(saleId) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-12">
      {!payable ? (
        <Card>
          <p className="text-center text-gray-600 dark:text-gray-400">
            This payment link is invalid or has expired. Please contact the business directly.
          </p>
        </Card>
      ) : payable.outstanding.lte(0) ? (
        <Card>
          <p className="text-center text-green-700 dark:text-green-400">
            This balance with {payable.companyName} has already been settled — nothing left to pay. Thank you!
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">You owe</p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatMoney(payable.outstanding.toString(), payable.currency)}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              To {payable.companyName} · Invoice {payable.saleNumber}
            </p>
          </div>

          <PayNowForm saleId={payable.saleId} />
        </Card>
      )}

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Powered by{" "}
        <Link href="/sign-up" className="font-medium text-[var(--brand-primary)] hover:underline">
          Multi-Branch Inventory
        </Link>{" "}
        — free bookkeeping for your own business.
      </p>
    </div>
  );
}
