"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Building2,
  Boxes,
  ArrowLeftRight,
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
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-log", label: "Audit log", icon: ScrollText },
  { href: "/staff", label: "Staff", icon: UserCog, planFeatureKey: "maxStaff" },
  { href: "/settings/branding", label: "Settings", icon: Settings },
];

export function AppNav({ planFeatures }: { planFeatures: PlanFeatures }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {NAV_LINKS.map((link) => {
        const active = link.href === "/settings/branding" ? pathname.startsWith("/settings") : pathname.startsWith(link.href);
        const cap = link.planFeatureKey ? planFeatures[link.planFeatureKey] : undefined;
        const lockedByPlan = cap === 0;
        const Icon = link.icon;

        if (lockedByPlan) {
          return (
            <Link
              key={link.href}
              href="/settings/billing"
              title={`${link.label} isn't included on your current plan — upgrade to unlock it.`}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-gray-300 grayscale transition-colors hover:bg-gray-50 hover:text-gray-400"
            >
              <Icon size={16} strokeWidth={2} />
              {link.label}
              <Lock size={11} strokeWidth={2.5} />
            </Link>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
              active
                ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Icon size={16} strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
