import Link from "next/link";
import { ShoppingCart, TrendingUp, TrendingDown, Wallet, Users, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPeriodSummary, getOutstandingDebt, startOfCurrentMonth, startOfToday } from "@/server/services/report-service";
import { getCustomerBalances } from "@/server/services/customer-service";
import { getLowStockProducts, getExpiringBatches } from "@/server/services/inventory-service";
import { StatCard, Card, LinkButton } from "@/components/ui";

export default async function DashboardPage() {
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const [subscription, branchCount, warehouseCount, today, thisMonth, outstanding, customers, lowStock, expiringBatches, company, permissions, user] =
    await Promise.all([
      getSubscriptionForCompany(membership.companyId),
      db.branch.count({ where: { isActive: true } }),
      db.warehouse.count({ where: { isActive: true } }),
      getPeriodSummary(db, startOfToday()),
      getPeriodSummary(db, startOfCurrentMonth()),
      getOutstandingDebt(db),
      db.customer.findMany({ where: { isActive: true }, select: { id: true } }),
      getLowStockProducts(db),
      getExpiringBatches(db),
      db.company.findUniqueOrThrow({ where: { id: membership.companyId } }),
      computeEffectivePermissions(membership.membershipId),
      prisma.user.findUniqueOrThrow({ where: { id: membership.userId }, select: { twoFactorEnabled: true } }),
    ]);
  const active = isSubscriptionActive(subscription);
  const isOwner = membership.roleName === "Owner" && membership.roleIsSystem;
  const needsTwoFactor = isOwner && !user.twoFactorEnabled;
  const canManageCompanySettings = permissions.has(PERMISSIONS.SETTINGS_COMPANY);
  const verificationDeadlinePassed = company.verificationDeadline ? company.verificationDeadline < new Date() : false;
  const showVerificationBanner =
    company.verificationStatus === "REJECTED" || (company.verificationStatus === "UNVERIFIED" && verificationDeadlinePassed);

  const balances = await getCustomerBalances(db, customers.map((c) => c.id));
  const debtorCount = [...balances.values()].filter((b) => b.outstanding.gt(0)).length;

  // Same copy for everyone reads like a checklist of features a
  // single-branch, no-warehouse shop doesn't have and doesn't need —
  // describe what this company is actually set up to do instead.
  const managed = [
    "products",
    branchCount > 1 ? "branches" : "your branch",
    ...(warehouseCount > 0 ? ["warehouses", "stock transfers"] : []),
    "sales",
    "staff",
  ];
  const summary = managed.length > 1 ? `${managed.slice(0, -1).join(", ")}, and ${managed.at(-1)}` : managed[0];

  const monthProfitPositive = thisMonth.profit.gte(0);

  return (
    <div className="flex flex-col gap-6">
      {!active && (
        <Card variant="danger">
          <p className="text-sm text-red-700">
            Your subscription needs attention — access to products, sales, and other features is
            restricted until this is resolved.{" "}
            <Link href="/settings/billing" className="font-medium underline">
              Review billing
            </Link>
          </p>
        </Card>
      )}
      {needsTwoFactor && (
        <Card variant="danger">
          <p className="text-sm text-red-700">
            Two-factor authentication is required for the account Owner — access to products, sales, and other
            features is restricted until it&apos;s set up.{" "}
            <Link href="/settings/security" className="font-medium underline">
              Set up now
            </Link>
          </p>
        </Card>
      )}
      {showVerificationBanner && (
        <Card variant="warning">
          <p className="text-sm text-amber-800">
            {company.verificationStatus === "REJECTED"
              ? "Your business verification was rejected — resubmit your CAC certificate when it's ready."
              : "You haven't submitted a CAC certificate for verification yet — nothing is restricted, but a verified badge helps customers trust your business."}{" "}
            {canManageCompanySettings ? (
              <Link href="/settings/verification" className="font-medium underline">
                Go to verification
              </Link>
            ) : (
              "Ask an Owner or Admin to submit it."
            )}
          </p>
        </Card>
      )}
      {active && subscription?.status === "TRIALING" && subscription.trialEndsAt && (
        <Card variant="warning">
          <p className="text-sm text-amber-800">
            You&apos;re on a free trial until {subscription.trialEndsAt.toLocaleDateString()}.{" "}
            <Link href="/settings/billing" className="font-medium underline">
              Add a plan
            </Link>
          </p>
        </Card>
      )}

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome to {membership.companyName}</h1>
        <p className="mt-1 text-gray-500">Manage {summary} from the navigation above.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={ShoppingCart}
          label="Today's sales"
          value={formatMoney(today.revenue.toString(), currency)}
          detail={`${today.saleCount} sale${today.saleCount === 1 ? "" : "s"} today`}
          tint="var(--brand-primary)"
        />
        <StatCard
          icon={monthProfitPositive ? TrendingUp : TrendingDown}
          label="This month's profit"
          value={formatMoney(thisMonth.profit.toString(), currency)}
          detail={`${formatMoney(thisMonth.revenue.toString(), currency)} revenue, ${formatMoney(thisMonth.expenses.toString(), currency)} expenses`}
          tint={monthProfitPositive ? "#16a34a" : "#dc2626"}
        />
        <StatCard
          icon={Wallet}
          label="Outstanding debt"
          value={formatMoney(outstanding.toString(), currency)}
          detail="Owed across all open sales"
          tint="#d97706"
        />
        <StatCard
          icon={Users}
          label="Debtors"
          value={String(debtorCount)}
          detail="Customers who owe money"
          tint="#7c3aed"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low stock"
          value={String(lowStock.length)}
          detail={
            lowStock.length > 0
              ? `${lowStock
                  .slice(0, 2)
                  .map((p) => p.name)
                  .join(", ")}${lowStock.length > 2 ? "…" : ""}`
              : "All products above their reorder point"
          }
          tint="#ea580c"
          href="/products"
        />
        <StatCard
          icon={Clock}
          label="Expiring soon"
          value={String(expiringBatches.length)}
          detail={
            expiringBatches.length > 0
              ? `${expiringBatches.filter((b) => b.isExpired).length} already expired`
              : "Nothing expiring in the next 14 days"
          }
          tint="#0891b2"
          href="/batches"
        />
      </div>

      <LinkButton href="/reports" variant="link" className="group flex w-fit items-center gap-1.5">
        View full reports
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </LinkButton>
    </div>
  );
}
