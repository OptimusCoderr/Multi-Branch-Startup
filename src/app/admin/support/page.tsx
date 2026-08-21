import { requirePlatformStaffWithTwoFactor } from "@/lib/auth/session";
import { PasswordResetTool } from "@/components/forms/password-reset-tool";
import { AdminPageHeader } from "@/components/ui-admin";

export default async function AdminSupportPage() {
  await requirePlatformStaffWithTwoFactor();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Support"
        description="Help a locked-out user reset their password. Verify who you're talking to before sharing the link — it grants access to their account."
      />

      <PasswordResetTool />
    </div>
  );
}
