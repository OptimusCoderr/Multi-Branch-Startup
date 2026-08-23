import Link from "next/link";
import { Banknote, CreditCard, Receipt, TrendingUp, TrendingDown, ShoppingCart, Clock, Download } from "lucide-react";
import { requireMembership, computeEffectivePermissions, isOwnerMembership } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPeriodSummary, getOutstandingDebt, startOfToday } from "@/server/services/report-service";
import { getCustomerBalances } from "@/server/services/customer-service";
import { getLowStockProducts, getExpiringBatches } from "@/server/services/inventory-service";
import { StatCard, Card, Badge } from "@/components/ui";
import { ResetSalesDayForm } from "@/components/forms/reset-sales-day-form";
import { DailySummaryCard } from "@/components/daily-summary-card";

const REPORT_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Pending review",
  APPROVED: "Approved",
  SENT_BACK: "Sent back",
  REJECTED: "Rejected",
};

export default async function DashboardPage() {
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;
  const today = startOfToday();
  const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [
    subscription,
    branchCount,
    warehouseCount,
    todaySummary,
    outstanding,
    customers,
    lowStock,
    expiringBatches,
    company,
    permissions,
    user,
    cashToday,
    posToday,
    reportStatusCounts,
  ] = await Promise.all([
    getSubscriptionForCompany(membership.companyId),
    db.branch.count({ where: { isActive: true } }),
    db.warehouse.count({ where: { isActive: true } }),
    getPeriodSummary(db, today),
    getOutstandingDebt(db),
    db.customer.findMany({ where: { isActive: true }, select: { id: true } }),
    getLowStockProducts(db),
    getExpiringBatches(db),
    db.company.findUniqueOrThrow({ where: { id: membership.companyId } }),
    computeEffectivePermissions(membership.membershipId),
    prisma.user.findUniqueOrThrow({ where: { id: membership.userId }, select: { twoFactorEnabled: true } }),
    db.payment.aggregate({ where: { mode: "CASH", paidAt: { gte: today }, sale: { status: { not: "VOIDED" } } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { mode: "POS", paidAt: { gte: today }, sale: { status: { not: "VOIDED" } } }, _sum: { amount: true } }),
    db.dailySalesReport.groupBy({ by: ["status"], where: { reportDate: { gte: sevenDaysAgo } }, _count: true }),
  ]);
  const active = isSubscriptionActive(subscription);
  const isOwner = isOwnerMembership(membership);
  const needsTwoFactor = isOwner && !user.twoFactorEnabled;
  const canManageCompanySettings = permissions.has(PERMISSIONS.SETTINGS_COMPANY);
  const verificationDeadlinePassed = company.verificationDeadline ? company.verificationDeadline < new Date() : false;
  const showVerificationBanner =
    company.verificationStatus === "REJECTED" || (company.verificationStatus === "UNVERIFIED" && verificationDeadlinePassed);

  const balances = await getCustomerBalances(db, customers.map((c) => c.id));
  const debtorCount = [...balances.values()].filter((b) => b.outstanding.gt(0)).length;
  const netIncomePositive = todaySummary.profit.gte(0);

  const managed = [
    "products",
    branchCount > 1 ? "branches" : "your branch",
    ...(warehouseCount > 0 ? ["warehouses", "stock transfers"] : []),
    "sales",
    "staff",
  ];
  const summary = managed.length > 1 ? `${managed.slice(0, -1).join(", ")}, and ${managed.at(-1)}` : managed[0];

  const reportStatusTotal = reportStatusCounts.reduce((sum, r) => sum + r._count, 0);
  const countFor = (status: string) => reportStatusCounts.find((r) => r.status === status)?._count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {!active && (
        <Card variant="danger">
          <p className="text-sm text-red-700 dark:text-red-400">
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
          <p className="text-sm text-red-700 dark:text-red-400">
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
          <p className="text-sm text-amber-800 dark:text-amber-300">
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
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You&apos;re on a free trial until {subscription.trialEndsAt.toLocaleDateString()}.{" "}
            <Link href="/settings/billing" className="font-medium underline">
              Add a plan
            </Link>
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome to {membership.companyName}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Manage{" "}
            {summary} from the navigation above.
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <a
              href="/api/exports/backup"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Download size={14} />
              Backup
            </a>
            <ResetSalesDayForm />
          </div>
        )}
      </div>

      <DailySummaryCard
        companyName={membership.companyName}
        dateLabel={new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        salesTotal={formatMoney(todaySummary.revenue.toString(), currency)}
        saleCount={todaySummary.saleCount}
        expensesTotal={formatMoney(todaySummary.expenses.toString(), currency)}
        profitTotal={formatMoney(todaySummary.profit.toString(), currency)}
        outstandingTotal={formatMoney(outstanding.toString(), currency)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={ShoppingCart}
          label="Today's sales"
          value={formatMoney(todaySummary.revenue.toString(), currency)}
          detail={`${todaySummary.saleCount} sale${todaySummary.saleCount === 1 ? "" : "s"} today`}
          tint="var(--brand-primary)"
        />
        <StatCard
          icon={Banknote}
          label="Cash sales"
          value={formatMoney((cashToday._sum.amount ?? 0).toString(), currency)}
          detail="Collected today"
          tint="#16a34a"
        />
        <StatCard
          icon={CreditCard}
          label="POS sales"
          value={formatMoney((posToday._sum.amount ?? 0).toString(), currency)}
          detail="Collected today"
          tint="#2563eb"
        />
        <StatCard
          icon={Receipt}
          label="Today's expenses"
          value={formatMoney(todaySummary.expenses.toString(), currency)}
          detail="Recorded today"
          tint="#dc2626"
        />
        <StatCard
          icon={netIncomePositive ? TrendingUp : TrendingDown}
          label="Net income"
          value={formatMoney(todaySummary.profit.toString(), currency)}
          detail="Today's sales minus expenses"
          tint={netIncomePositive ? "#059669" : "#e11d48"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sales report status (last 7 days)</p>
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(REPORT_STATUS_LABELS).map(([status, label]) => {
              const count = countFor(status);
              const pct = reportStatusTotal > 0 ? (count / reportStatusTotal) * 100 : 0;
              return (
                <div key={status} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right font-medium text-gray-900 dark:text-gray-100">{count}</span>
                </div>
              );
            })}
            {reportStatusTotal === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No reports submitted yet.</p>}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Debtors overview</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Active debtors</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{debtorCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total owed</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">{formatMoney(outstanding.toString(), currency)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${customers.length > 0 ? ((customers.length - debtorCount) / customers.length) * 100 : 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {customers.length > 0 ? Math.round(((customers.length - debtorCount) / customers.length) * 100) : 100}% of customers are
              debt-free
            </p>
          </div>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Low stock alerts</p>
            <Link href="/products" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
              View products
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lowStock.slice(0, 20).map((p) => (
              <div key={p.productId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <span className="truncate text-sm text-gray-700 dark:text-gray-300">{p.name}</span>
                <Badge variant={p.totalStock <= 0 ? "danger" : "warning"}>{p.totalStock}</Badge>
              </div>
            ))}
          </div>
          {lowStock.length > 20 && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              +{lowStock.length - 20} more —{" "}
              <Link href="/products" className="underline">
                view products
              </Link>
            </p>
          )}
        </Card>
      )}

      {expiringBatches.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Clock size={15} className="text-cyan-600 dark:text-cyan-400" />
              Expiring soon
            </p>
            <Link href="/batches" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
              View batches
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {expiringBatches.slice(0, 10).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                  {b.productName} · {b.locationName}
                </span>
                <Badge variant={b.isExpired ? "danger" : "warning"}>{b.isExpired ? "Expired" : b.expiryDate.toLocaleDateString()}</Badge>
              </div>
            ))}
          </div>
          {expiringBatches.length > 10 && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              +{expiringBatches.length - 10} more —{" "}
              <Link href="/batches" className="underline">
                view batches
              </Link>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
