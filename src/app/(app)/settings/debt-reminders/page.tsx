import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isSmsConfigured } from "@/lib/notifications/sms-client";
import { DebtReminderSettingsForm } from "@/components/forms/debt-reminder-settings-form";
import { SettingsNav } from "@/components/layout/settings-nav";
import { PageHeader } from "@/components/ui";

export default async function DebtReminderSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SETTINGS_COMPANY)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to change company settings.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const company = await db.company.findUnique({ where: { id: membership.companyId } });
  if (!company) return null;

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav current="/settings/debt-reminders" />
      <PageHeader title="Debt reminders" />
      <DebtReminderSettingsForm
        defaultValues={{
          debtReminderEnabled: company.debtReminderEnabled,
          debtReminderDaysOverdue: company.debtReminderDaysOverdue,
        }}
        smsConfigured={isSmsConfigured()}
      />
    </div>
  );
}
