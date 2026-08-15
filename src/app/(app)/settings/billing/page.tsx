import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { parsePlanFeatures } from "@/lib/billing/plan-features";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/db/prisma";
import { CheckoutButton } from "@/components/forms/checkout-button";

const STATUS_STYLES: Record<string, string> = {
  TRIALING: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-700",
  INCOMPLETE: "bg-gray-100 text-gray-500",
};

export default async function BillingSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.BILLING_MANAGE)) {
    return <p className="text-gray-500">You don&apos;t have permission to manage billing.</p>;
  }

  const [subscription, plans] = await Promise.all([
    getSubscriptionForCompany(membership.companyId),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceKobo: "asc" } }),
  ]);

  const active = isSubscriptionActive(subscription);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {subscription && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[subscription.status] ?? ""}`}>
              {subscription.status.replace("_", " ")}
            </span>
            <span className="text-sm font-medium">{subscription.plan.name}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
            {subscription.status === "TRIALING" && subscription.trialEndsAt && (
              <p>Trial ends {subscription.trialEndsAt.toLocaleDateString()}.</p>
            )}
            {subscription.currentPeriodEnd && <p>Current period ends {subscription.currentPeriodEnd.toLocaleDateString()}.</p>}
            {!active && (
              <p className="font-medium text-red-600">
                Your subscription needs attention — access to the app is restricted until this is resolved.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-gray-700">Plans</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const features = parsePlanFeatures(plan.features);
            const isCurrent = subscription?.planId === plan.id && subscription.status === "ACTIVE";
            return (
              <div key={plan.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
                <p className="font-semibold">{plan.name}</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(plan.priceKobo / 100, "NGN")}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <ul className="text-sm text-gray-500">
                  {features.maxBranches && <li>Up to {features.maxBranches} branches</li>}
                  {features.maxWarehouses && <li>Up to {features.maxWarehouses} warehouses</li>}
                  {features.maxStaff && <li>Up to {features.maxStaff} staff</li>}
                </ul>
                {isCurrent ? (
                  <span className="mt-2 self-start rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-500">Current plan</span>
                ) : (
                  <div className="mt-2">
                    <CheckoutButton planId={plan.id} label="Subscribe" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
