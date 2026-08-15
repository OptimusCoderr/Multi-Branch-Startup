import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";

export default async function DashboardPage() {
  const membership = await requireMembership();
  const subscription = await getSubscriptionForCompany(membership.companyId);
  const active = isSubscriptionActive(subscription);

  return (
    <div className="flex flex-col gap-4">
      {!active && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your subscription needs attention — access to products, sales, and other features is
          restricted until this is resolved.{" "}
          <Link href="/settings/billing" className="font-medium underline">
            Review billing
          </Link>
        </div>
      )}
      {active && subscription?.status === "TRIALING" && subscription.trialEndsAt && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          You&apos;re on a free trial until {subscription.trialEndsAt.toLocaleDateString()}.{" "}
          <Link href="/settings/billing" className="font-medium underline">
            Add a plan
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-semibold">Welcome to {membership.companyName}</h1>
      <p className="text-gray-500">
        Manage products, warehouses, branches, stock transfers, sales, and staff from the
        navigation above.
      </p>
    </div>
  );
}
