import { requirePlatformStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { TwoFactorSecurityPanel } from "@/components/auth/two-factor-security-panel";
import { AdminPageHeader } from "@/components/ui-admin";

// Deliberately calls the plain requirePlatformStaff() (no 2FA gate) —
// this is the page every other /admin page redirects to when a platform
// staff member hasn't set up 2FA yet, so it must always stay reachable.
export default async function AdminSecurityPage() {
  const staff = await requirePlatformStaff();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: staff.userId }, select: { twoFactorEnabled: true } });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Account security"
        description="Two-factor authentication is required for every platform staff account — you can see across every company on the platform."
      />

      <TwoFactorSecurityPanel initialEnabled={user.twoFactorEnabled} mandatory variant="dark" />
    </div>
  );
}
