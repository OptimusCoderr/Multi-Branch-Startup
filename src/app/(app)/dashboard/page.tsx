import Link from "next/link";
import { ShoppingCart, TrendingUp, TrendingDown, Wallet, Users, ArrowRight } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { formatMoney } from "@/lib/format";
import { getPeriodSummary, getOutstandingDebt, startOfCurrentMonth, startOfToday } from "@/server/services/report-service";
import { getCustomerBalances } from "@/server/services/customer-service";

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tint,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  detail?: string;
  tint: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        // color-mix() rather than string-concatenating an alpha hex suffix
        // (`${tint}1a`) — that only produces valid CSS when tint is a hex
        // literal; the "Today's sales" card passes a CSS var()
        // (var(--brand-primary)), which `${tint}1a` mangles into
        // "var(--brand-primary)1a", an invalid value the browser silently
        // drops. color-mix() works uniformly for both hex and var() tints.
        style={{ backgroundColor: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
      >
        <Icon size={18} strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-gray-900">{value}</p>
        {detail && <p className="mt-0.5 text-xs text-gray-500">{detail}</p>}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const [subscription, branchCount, warehouseCount, today, thisMonth, outstanding, customers] = await Promise.all([
    getSubscriptionForCompany(membership.companyId),
    db.branch.count({ where: { isActive: true } }),
    db.warehouse.count({ where: { isActive: true } }),
    getPeriodSummary(db, startOfToday()),
    getPeriodSummary(db, startOfCurrentMonth()),
    getOutstandingDebt(db),
    db.customer.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);
  const active = isSubscriptionActive(subscription);

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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your subscription needs attention — access to products, sales, and other features is
          restricted until this is resolved.{" "}
          <Link href="/settings/billing" className="font-medium underline">
            Review billing
          </Link>
        </div>
      )}
      {active && subscription?.status === "TRIALING" && subscription.trialEndsAt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You&apos;re on a free trial until {subscription.trialEndsAt.toLocaleDateString()}.{" "}
          <Link href="/settings/billing" className="font-medium underline">
            Add a plan
          </Link>
        </div>
      )}

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome to {membership.companyName}</h1>
        <p className="mt-1 text-gray-500">Manage {summary} from the navigation above.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <Link
        href="/reports"
        className="group flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:underline"
      >
        View full reports
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
