import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { parsePlanFeatures } from "@/lib/billing/plan-features";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/db/prisma";
import { CheckoutButton } from "@/components/forms/checkout-button";
import { SettingsNav } from "@/components/layout/settings-nav";
import { PageHeader, Card, Badge, type BadgeVariant } from "@/components/ui";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  TRIALING: "warning",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "danger",
  INCOMPLETE: "neutral",
};

export default async function BillingSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.BILLING_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to manage billing.</p>;
  }

  const [subscription, plans] = await Promise.all([
    getSubscriptionForCompany(membership.companyId),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceKobo: "asc" } }),
  ]);

  const active = isSubscriptionActive(subscription);

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav current="/settings/billing" />
      <PageHeader title="Billing" />

      {subscription && (
        <Card>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANTS[subscription.status] ?? "neutral"}>{subscription.status.replace("_", " ")}</Badge>
            <span className="text-sm font-medium">{subscription.plan.name}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
            {subscription.status === "TRIALING" && subscription.trialEndsAt && (
              <p>Trial ends {subscription.trialEndsAt.toLocaleDateString()}.</p>
            )}
            {subscription.currentPeriodEnd && <p>Current period ends {subscription.currentPeriodEnd.toLocaleDateString()}.</p>}
            {!active && (
              <p className="font-medium text-red-600 dark:text-red-400">
                Your subscription needs attention — access to the app is restricted until this is resolved.
              </p>
            )}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Plans</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const features = parsePlanFeatures(plan.features);
            const isCurrent = subscription?.planId === plan.id && subscription.status === "ACTIVE";
            return (
              <Card key={plan.id} className="flex flex-col gap-2">
                <p className="font-display font-semibold text-gray-900 dark:text-gray-100">{plan.name}</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(plan.priceKobo / 100, "NGN")}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mo</span>
                </p>
                <ul className="text-sm text-gray-500 dark:text-gray-400">
                  {features.maxBranches !== undefined && (
                    <li>
                      Up to {features.maxBranches} branch{features.maxBranches === 1 ? "" : "es"}
                    </li>
                  )}
                  {features.maxWarehouses !== undefined && (
                    <li>{features.maxWarehouses === 0 ? "No warehouse" : `Up to ${features.maxWarehouses} warehouses`}</li>
                  )}
                  {features.maxStaff !== undefined && <li>Up to {features.maxStaff} staff</li>}
                </ul>
                {isCurrent ? (
                  <Badge variant="neutral">Current plan</Badge>
                ) : (
                  <div className="mt-2">
                    <CheckoutButton planId={plan.id} label="Subscribe" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
