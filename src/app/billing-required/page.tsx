import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { computeEffectivePermissions } from "@/lib/auth/session";

export default async function BillingRequiredPage() {
  const membership = await requireMembership();
  const subscription = await getSubscriptionForCompany(membership.companyId);

  // If billing was fixed since this page loaded, don't leave people stuck.
  if (isSubscriptionActive(subscription)) redirect("/dashboard");

  const permissions = await computeEffectivePermissions(membership.membershipId);
  const canManageBilling = permissions.has(PERMISSIONS.BILLING_MANAGE);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Subscription needs attention</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {subscription?.status === "PAST_DUE"
          ? "A recent payment didn't go through and the grace period has ended."
          : subscription?.status === "CANCELLED"
            ? "This company's subscription has been cancelled."
            : "This company's trial has ended."}{" "}
        {canManageBilling
          ? "Update billing to restore access."
          : "Ask an Owner or Admin to update billing to restore access."}
      </p>
      {canManageBilling && (
        <Link href="/settings/billing" className="mx-auto rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
          Go to billing settings
        </Link>
      )}
    </main>
  );
}
