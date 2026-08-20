import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getBrandingSettings } from "@/lib/branding";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LogoPlaceholder } from "@/components/logo-placeholder";
import { AppNav } from "@/components/layout/app-nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembership();
  const [branding, planFeatures, permissions] = await Promise.all([
    getBrandingSettings(membership.companyId),
    getPlanFeaturesForCompany(membership.companyId),
    computeEffectivePermissions(membership.membershipId),
  ]);
  const canManageBilling = permissions.has(PERMISSIONS.BILLING_MANAGE);

  // Company-picked colors flow through as CSS custom properties, consumed
  // by Tailwind's arbitrary-value syntax (bg-[var(--brand-primary)]) on
  // primary actions across the app — never leaks between companies since
  // it's read fresh, scoped by companyId, on every render of this layout.
  const themeStyle = {
    "--brand-primary": branding.primaryColor,
    "--brand-secondary": branding.secondaryColor ?? branding.primaryColor,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-gray-50" style={themeStyle}>
      <header
        data-layout={branding.layoutPreset}
        className="sticky top-0 z-10 flex flex-col bg-white/90 shadow-sm backdrop-blur print:hidden"
      >
        <div
          className="flex items-center justify-between px-6 pt-4 pb-2.5 data-[layout=COMPACT]:pt-2 data-[layout=COMPACT]:pb-1"
          data-layout={branding.layoutPreset}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {branding.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={`${membership.companyName} logo`}
                width={30}
                height={30}
                unoptimized
                className="shrink-0 rounded-lg"
              />
            ) : (
              <div className="shrink-0">
                <LogoPlaceholder size={30} color={branding.primaryColor} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold leading-tight">{membership.companyName}</p>
              <p className="text-xs text-gray-500">{membership.roleName ?? "Staff"}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
        <div className="px-6 pb-3 data-[layout=COMPACT]:pb-1.5" data-layout={branding.layoutPreset}>
          <AppNav planFeatures={planFeatures} canManageBilling={canManageBilling} />
        </div>
        {/* A quiet brand accent — the one place a company's color pairing
            shows up even when the rest of the chrome stays neutral. */}
        <div
          className="h-0.5 w-full"
          style={{ background: "linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))" }}
        />
      </header>
      <main
        data-layout={branding.layoutPreset}
        className="mx-auto max-w-5xl px-6 py-8 data-[layout=COMPACT]:py-4 print:max-w-none print:p-0"
      >
        {children}
      </main>
    </div>
  );
}
