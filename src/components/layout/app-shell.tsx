"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import type { PlanFeatures } from "@/lib/billing/plan-features";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LogoPlaceholder } from "@/components/logo-placeholder";
import { AppNav } from "@/components/layout/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConfirmProvider } from "@/components/ui/confirm";

/**
 * Left sidebar app shell. A client component (not layout.tsx itself)
 * purely so the mobile drawer open/close state can live somewhere —
 * layout.tsx stays a server component that does the actual data fetching
 * (membership/branding/permissions) and passes the results down as props.
 */
export function AppShell({
  companyName,
  roleName,
  logoUrl,
  primaryColor,
  layoutPreset,
  planFeatures,
  canManageBilling,
  unreadNotifications = 0,
  children,
}: {
  companyName: string;
  roleName: string;
  logoUrl: string | null;
  primaryColor: string;
  layoutPreset: string;
  planFeatures: PlanFeatures;
  canManageBilling: boolean;
  unreadNotifications?: number;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const compact = layoutPreset === "COMPACT";

  return (
    <ConfirmProvider>
      <div className="flex min-h-screen">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-gray-950 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden ${
            mobileOpen ? "translate-x-0" : ""
          }`}
        >
          <div className={`relative flex items-center gap-2.5 border-b border-gray-100 px-5 dark:border-gray-800 ${compact ? "py-3" : "py-5"}`}>
            {logoUrl ? (
              <Image src={logoUrl} alt={`${companyName} logo`} width={30} height={30} unoptimized className="shrink-0 rounded-lg" />
            ) : (
              <div className="shrink-0">
                <LogoPlaceholder size={30} color={primaryColor} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">{companyName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{roleName}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {/* A quiet brand accent — the one place a company's color pairing
                shows up even when the rest of the chrome stays neutral. */}
            <span
              className="absolute inset-y-0 right-0 w-0.5"
              style={{ background: "linear-gradient(180deg, var(--brand-primary), var(--brand-secondary))" }}
            />
          </div>

          <div className={`flex-1 overflow-y-auto px-3 ${compact ? "py-2" : "py-4"}`}>
            <AppNav
              planFeatures={planFeatures}
              canManageBilling={canManageBilling}
              unreadNotifications={unreadNotifications}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="flex-1 font-display text-sm font-semibold text-gray-900 dark:text-gray-100">{companyName}</span>
            <ThemeToggle />
          </div>

          <main
            data-layout={layoutPreset}
            className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 data-[layout=COMPACT]:py-4 print:max-w-none print:p-0"
          >
            {children}
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
