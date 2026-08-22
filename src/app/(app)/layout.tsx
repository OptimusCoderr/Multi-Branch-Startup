import type { CSSProperties, ReactNode } from "react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getBrandingSettings } from "@/lib/branding";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/layout/app-shell";

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
    <div className="brand-scope min-h-screen bg-gray-50" style={themeStyle}>
      <AppShell
        companyName={membership.companyName}
        roleName={membership.roleName ?? "Staff"}
        logoUrl={branding.logoUrl}
        primaryColor={branding.primaryColor}
        layoutPreset={branding.layoutPreset}
        planFeatures={planFeatures}
        canManageBilling={canManageBilling}
      >
        {children}
      </AppShell>
    </div>
  );
}
