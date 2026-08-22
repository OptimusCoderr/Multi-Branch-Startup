"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Building2,
  Boxes,
  PackageSearch,
  ArrowLeftRight,
  ClipboardList,
  ShoppingCart,
  Users,
  Receipt,
  BarChart3,
  ScrollText,
  UserCog,
  Settings,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { PlanFeatures } from "@/lib/billing/plan-features";

// Deliberately NOT trimmed by branch/warehouse count: a company with zero
// warehouses today still needs "Warehouses" in nav to be the one place
// they'd ever discover they can add one later. Hiding it would make that
// path undiscoverable, not just decluttered. The friction this app
// actually had for a single-shop/no-warehouse business — a broken empty
// dropdown on /transfers/new, and dashboard copy that assumed every
// company uses both — is fixed at the source on those pages instead.
//
// `planFeatureKey` is a genuinely different signal from "0 created so
// far": it's the plan's *cap*. A cap of exactly 0 (Solo's maxWarehouses,
// for example) means this feature isn't part of the current plan at
// all, not just "not set up yet" — that's the one case worth actually
// greying out and pointing at billing instead of leaving fully enabled.
const NAV_LINKS: { href: string; label: string; icon: LucideIcon; planFeatureKey?: keyof PlanFeatures }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/warehouses", label: "Warehouses", icon: Warehouse, planFeatureKey: "maxWarehouses" },
  { href: "/branches", label: "Branches", icon: Building2, planFeatureKey: "maxBranches" },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/batches", label: "Batches", icon: PackageSearch },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/purchase-orders", label: "Purchase orders", icon: ClipboardList },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-log", label: "Audit log", icon: ScrollText },
  { href: "/staff", label: "Staff", icon: UserCog, planFeatureKey: "maxStaff" },
  { href: "/settings/branding", label: "Settings", icon: Settings },
];

export function AppNav({
  planFeatures,
  canManageBilling,
  onNavigate,
}: {
  planFeatures: PlanFeatures;
  canManageBilling: boolean;
  /** Fired when a link is actually followed — lets the mobile drawer close itself on navigate. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {NAV_LINKS.map((link) => {
        const active = link.href === "/settings/branding" ? pathname.startsWith("/settings") : pathname.startsWith(link.href);
        const cap = link.planFeatureKey ? planFeatures[link.planFeatureKey] : undefined;
        const lockedByPlan = cap === 0;
        const Icon = link.icon;

        if (lockedByPlan) {
          const title = canManageBilling
            ? `${link.label} isn't included on your current plan — upgrade to unlock it.`
            : `${link.label} isn't included on your company's current plan. Ask an Owner or Admin to upgrade.`;
          const lockedClassName = "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-gray-300 grayscale dark:text-gray-700";

          // Only link to billing for someone who can actually act on it —
          // otherwise this is a dead end (/settings/billing itself blocks
          // anyone without BILLING_MANAGE), so it's just a greyed-out,
          // non-interactive label explaining why the feature is locked.
          if (!canManageBilling) {
            return (
              <span key={link.href} title={title} className={lockedClassName}>
                <Icon size={17} strokeWidth={2} />
                {link.label}
                <Lock size={11} strokeWidth={2.5} className="ml-auto" />
              </span>
            );
          }

          return (
            <Link
              key={link.href}
              href="/settings/billing"
              title={title}
              onClick={onNavigate}
              className={`${lockedClassName} transition-colors hover:bg-gray-50 hover:text-gray-400 dark:hover:bg-gray-900`}
            >
              <Icon size={17} strokeWidth={2} />
              {link.label}
              <Lock size={11} strokeWidth={2.5} className="ml-auto" />
            </Link>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors ${
              active
                ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <Icon size={17} strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
