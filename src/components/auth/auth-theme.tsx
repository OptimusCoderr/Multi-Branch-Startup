"use client";

import { createContext, useContext, type ReactNode } from "react";
import { LogoPlaceholder } from "@/components/logo-placeholder";

export type AuthTheme = { accent: string };

/**
 * The same indigo→fuchsia gradient and accent the homepage uses (see
 * --accent-gradient in globals.css) — the sign-up/sign-in/reset-password/
 * onboarding flow should read as the same product as the marketing page a
 * visitor just left, not a re-skinned one. Previously this regenerated a
 * random hue on every page load; that made the brand feel inconsistent
 * rather than distinctive, so it's fixed now.
 */
const AUTH_THEME: AuthTheme = { accent: "#4f46e5" }; // indigo-600 — reads clearly as text/focus-ring on white

const AuthThemeContext = createContext<AuthTheme>(AUTH_THEME);

/** For any client component nested inside AuthThemeShell that wants the brand accent color (focus rings, links). */
export function useAuthTheme(): AuthTheme {
  return useContext(AuthThemeContext);
}

const VALUE_PROPS = [
  "Every branch and warehouse, one view",
  "Granular per-staff permissions",
  "A full accountability trail for every sale and stock movement",
];

/**
 * The sign-up/sign-in/reset-password/onboarding pages' shell — a split
 * panel on larger screens (brand gradient + value props on the left, the
 * form on the right), collapsing to just the form with a small header on
 * mobile. There's no company to derive branding from at this point
 * (Phase 5's BrandingSettings only ever applies once one exists), so this
 * uses the same fixed marketing-site brand instead.
 */
export function AuthThemeShell({ children }: { children: ReactNode }) {
  return (
    <AuthThemeContext.Provider value={AUTH_THEME}>
      <main className="flex min-h-screen flex-col lg:flex-row">
        <div
          className="relative hidden shrink-0 flex-col justify-between overflow-hidden p-10 text-white lg:flex lg:w-[40%]"
          style={{ background: "var(--accent-gradient)" }}
        >
          <div className="flex items-center gap-2.5">
            <LogoPlaceholder size={32} color="#ffffff" />
            <span className="font-display text-lg font-semibold">Multi-Branch Inventory</span>
          </div>

          <div>
            <p className="font-display text-3xl font-semibold leading-tight">Run every branch from one place.</p>
            <ul className="mt-8 flex flex-col gap-4 text-sm text-white/90">
              {VALUE_PROPS.map((prop) => (
                <li key={prop} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
                    ✓
                  </span>
                  {prop}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/60">Manage products, staff, and sales across every location.</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center p-4 py-10 sm:p-8">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <LogoPlaceholder size={30} color={AUTH_THEME.accent} />
              <span className="font-display text-lg font-semibold">Multi-Branch Inventory</span>
            </div>
            <div className="flex flex-col gap-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8 sm:shadow-lg lg:border-0 lg:p-0 lg:shadow-none">
              {children}
            </div>
          </div>
        </div>
      </main>
    </AuthThemeContext.Provider>
  );
}
