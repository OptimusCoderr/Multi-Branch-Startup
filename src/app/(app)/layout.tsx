import type { CSSProperties, ReactNode } from "react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getBrandingSettings } from "@/lib/branding";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const [branding, planFeatures, permissions, unreadNotifications] = await Promise.all([
    getBrandingSettings(membership.companyId),
    getPlanFeaturesForCompany(membership.companyId),
    computeEffectivePermissions(membership.membershipId),
    db.notification.count({ where: { membershipId: membership.membershipId, readAt: null } }),
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
    <div className="brand-scope min-h-screen bg-gray-50 dark:bg-gray-900" style={themeStyle}>
      <AppShell
        companyName={membership.companyName}
        roleName={membership.roleName ?? "Staff"}
        logoUrl={branding.logoUrl}
        primaryColor={branding.primaryColor}
        layoutPreset={branding.layoutPreset}
        planFeatures={planFeatures}
        canManageBilling={canManageBilling}
        unreadNotifications={unreadNotifications}
      >
        {children}
      </AppShell>
    </div>
  );
}
