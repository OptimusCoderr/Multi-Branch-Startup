import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isSmsConfigured } from "@/lib/notifications/sms-client";
import { DebtReminderSettingsForm } from "@/components/forms/debt-reminder-settings-form";
import { BuyReminderCreditsForm } from "@/components/forms/buy-reminder-credits-form";
import { SettingsNav } from "@/components/layout/settings-nav";
import { PageHeader, Card } from "@/components/ui";

export default async function DebtReminderSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SETTINGS_COMPANY)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to change company settings.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const company = await db.company.findUnique({ where: { id: membership.companyId } });
  if (!company) return null;

  const canBuyCredits = permissions.has(PERMISSIONS.BILLING_MANAGE);

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

      <Card className="max-w-md flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Reminder credits</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{company.reminderCreditBalance}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Each reminder actually sent uses one credit. Your plan includes a monthly allotment — buy more any time you
            need extra.
          </p>
        </div>
        {canBuyCredits && <BuyReminderCreditsForm currency={membership.companyCurrency} />}
      </Card>
    </div>
  );
}
