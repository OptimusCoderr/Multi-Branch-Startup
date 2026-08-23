"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import * as debtorPaymentService from "@/server/services/debtor-payment-service";
import { PaystackNotConfiguredError } from "@/lib/paystack/client";

type ActionResult = { error: string };

/**
 * The one server action in this app callable by someone who is NOT signed
 * in — a debtor tapping "Pay now" on their reminder link. saleId comes
 * from the already-verified token on the page that renders this form, not
 * from user input, so there's nothing here to authenticate against.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState; this action takes no form fields
export async function startDebtorPaymentAction(saleId: string, _prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  const h = await headers();
  const baseUrl = process.env.BETTER_AUTH_URL ?? `https://${h.get("host") ?? "localhost:3000"}`;

  let checkoutUrl: string;
  try {
    const result = await debtorPaymentService.startDebtorPayment(saleId, baseUrl);
    checkoutUrl = result.authorizationUrl;
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      return { error: err.message };
    }
    return { error: err instanceof debtorPaymentService.DebtorPaymentError ? err.message : "Could not start payment." };
  }

  redirect(checkoutUrl);
}
