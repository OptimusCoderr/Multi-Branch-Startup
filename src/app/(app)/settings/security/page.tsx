import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsNav } from "@/components/layout/settings-nav";
import { TwoFactorSecurityPanel } from "@/components/auth/two-factor-security-panel";
import { PageHeader } from "@/components/ui";

export default async function SecuritySettingsPage() {
  const membership = await requireMembership();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: membership.userId }, select: { twoFactorEnabled: true } });
  const isOwner = membership.roleName === "Owner" && membership.roleIsSystem;

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav current="/settings/security" />
      <PageHeader
        title="Account security"
        description={`Two-factor authentication adds a code from an authenticator app on top of your password.${isOwner ? " As the account Owner, this is required on your account." : ""}`}
      />

      <TwoFactorSecurityPanel initialEnabled={user.twoFactorEnabled} mandatory={isOwner} variant="light" />
    </div>
  );
}
