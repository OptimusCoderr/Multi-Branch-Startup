import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireMembershipWithTwoFactor } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";

/**
 * Wraps every route that needs a usable subscription to operate —
 * products, warehouses, branches, stock, transfers, sales, staff. It does
 * NOT wrap /dashboard or /settings: dashboard needs to stay reachable so a
 * company can see the "subscription needs attention" banner, and
 * /settings/billing needs to stay reachable so they can actually fix it.
 */
export default async function GatedLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembershipWithTwoFactor();
  const subscription = await getSubscriptionForCompany(membership.companyId);

  if (!isSubscriptionActive(subscription)) {
    redirect("/billing-required");
  }

  return children;
}
