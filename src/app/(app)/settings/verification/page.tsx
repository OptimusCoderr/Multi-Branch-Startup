import { ShieldCheck, ShieldAlert, Clock, ShieldX } from "lucide-react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SettingsNav } from "@/components/layout/settings-nav";
import { CacVerificationForm } from "@/components/forms/cac-verification-form";
import { CompanyProfileForm } from "@/components/forms/company-profile-form";
import { PageHeader, Card } from "@/components/ui";

const STATUS_COPY: Record<string, { label: string; icon: typeof ShieldCheck; className: string }> = {
  UNVERIFIED: { label: "Not yet verified", icon: ShieldAlert, className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  PENDING_REVIEW: { label: "Submitted — awaiting review", icon: Clock, className: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400" },
  VERIFIED: { label: "Verified", icon: ShieldCheck, className: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400" },
  REJECTED: { label: "Rejected — resubmission needed", icon: ShieldX, className: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400" },
  APPROVED_WITHOUT_CAC: { label: "Approved to operate without a CAC", icon: ShieldCheck, className: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400" },
};

export default async function VerificationSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SETTINGS_COMPANY)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view verification settings.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const company = await db.company.findUniqueOrThrow({ where: { id: membership.companyId } });

  const status = STATUS_COPY[company.verificationStatus] ?? STATUS_COPY.UNVERIFIED;
  const Icon = status.icon;
  const deadlinePassed = company.verificationDeadline ? company.verificationDeadline < new Date() : false;
  const canSubmit = ["UNVERIFIED", "PENDING_REVIEW", "REJECTED"].includes(company.verificationStatus);

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav current="/settings/verification" />
      <PageHeader
        title="Business verification"
        description="Submit your CAC certificate to get a verified badge on your company. Businesses without a CAC can still use the app — a platform admin can approve you to operate without one."
      />

      <CompanyProfileForm defaultValues={{ name: company.name }} />

      <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${status.className}`}>
        <Icon size={16} strokeWidth={2.25} />
        {status.label}
      </div>

      {company.verificationStatus === "REJECTED" && company.verificationNote && (
        <Card variant="danger">
          <p className="text-sm text-red-700 dark:text-red-400">Reason: {company.verificationNote}</p>
        </Card>
      )}

      {company.verificationStatus === "APPROVED_WITHOUT_CAC" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A platform admin reviewed this account and approved it to operate without a CAC certificate. You can still
          submit one later if you register.
        </p>
      )}

      {company.verificationStatus === "UNVERIFIED" && deadlinePassed && (
        <Card variant="warning">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Your 5-day submission window has passed. You can still submit your certificate below whenever it&apos;s
            ready — nothing about your account is restricted in the meantime.
          </p>
        </Card>
      )}

      {canSubmit && (
        <CacVerificationForm
          defaultValues={{
            rcNumber: company.rcNumber,
            incorporationDate: company.incorporationDate ? company.incorporationDate.toISOString().slice(0, 10) : null,
          }}
          submitLabel={company.verificationStatus === "REJECTED" ? "Resubmit for review" : "Submit for review"}
        />
      )}
    </div>
  );
}
