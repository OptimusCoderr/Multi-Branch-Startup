import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getBrandingSettings } from "@/lib/branding";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { BrandingForm } from "@/components/forms/branding-form";
import { SettingsNav } from "@/components/layout/settings-nav";
import { PageHeader } from "@/components/ui";

export default async function BrandingSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SETTINGS_BRANDING)) {
    return <p className="text-gray-500">You don&apos;t have permission to change branding settings.</p>;
  }

  const branding = await getBrandingSettings(membership.companyId);

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav current="/settings/branding" />
      <PageHeader title="Branding" />
      <BrandingForm
        defaultValues={{
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
          logoUrl: branding.logoUrl,
          layoutPreset: branding.layoutPreset,
        }}
      />
    </div>
  );
}
