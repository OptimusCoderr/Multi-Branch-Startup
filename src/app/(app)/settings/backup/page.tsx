import { ShieldCheck, Download, Smartphone } from "lucide-react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SettingsNav } from "@/components/layout/settings-nav";
import { PageHeader, Card, LinkButton } from "@/components/ui";

export default async function BackupSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const canExport = permissions.has(PERMISSIONS.REPORTS_VIEW);

  const db = getScopedPrisma(membership.companyId);
  const [saleCount, expenseCount, customerCount] = await Promise.all([
    db.sale.count(),
    db.expense.count(),
    db.customer.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav current="/settings/backup" />
      <PageHeader
        title="Data & backup"
        description="Where your records live, and how to get them back if something happens to a phone."
      />

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-600 dark:text-green-500" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your book is safely backed up</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Every sale, expense, and debtor you record is saved to our secure servers the moment it syncs — not just on
          one phone. If a phone is lost, stolen, or spoilt, nothing is lost with it: sign in with your email and
          password on any device and your full history is right there.
        </p>
        <div className="mt-1 grid grid-cols-3 gap-4 rounded-lg bg-gray-50 dark:bg-gray-900 p-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{saleCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sales recorded</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{expenseCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Expenses recorded</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{customerCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Customers saved</p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={20} className="text-gray-500 dark:text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">The one thing that isn&apos;t backed up yet</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A sale recorded on the mobile app while <strong>offline</strong> stays on that phone only until it syncs —
          it&apos;s the one moment your records live in just one place. Once it shows as synced (check the pending-sync
          banner on the Sales tab), it&apos;s safely backed up like everything else. Try to get back online within a
          day or so of recording offline sales, especially before switching or replacing a phone.
        </p>
      </Card>

      {canExport && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Download size={20} className="text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Keep your own copy too</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Download a CSV of your sales, products, or customers any time — useful for your own records, an
            accountant, or a bank loan application.
          </p>
          <LinkButton href="/sales" variant="secondary" className="self-start">
            Go to exports
          </LinkButton>
        </Card>
      )}
    </div>
  );
}
