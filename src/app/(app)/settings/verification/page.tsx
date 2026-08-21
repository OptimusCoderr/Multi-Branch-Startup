import { ShieldCheck, ShieldAlert, Clock, ShieldX } from "lucide-react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SettingsNav } from "@/components/layout/settings-nav";
import { CacVerificationForm } from "@/components/forms/cac-verification-form";

const STATUS_COPY: Record<string, { label: string; icon: typeof ShieldCheck; className: string }> = {
  UNVERIFIED: { label: "Not yet verified", icon: ShieldAlert, className: "bg-gray-100 text-gray-600" },
  PENDING_REVIEW: { label: "Submitted — awaiting review", icon: Clock, className: "bg-amber-100 text-amber-700" },
  VERIFIED: { label: "Verified", icon: ShieldCheck, className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected — resubmission needed", icon: ShieldX, className: "bg-red-100 text-red-700" },
  APPROVED_WITHOUT_CAC: { label: "Approved to operate without a CAC", icon: ShieldCheck, className: "bg-blue-100 text-blue-700" },
};

export default async function VerificationSettingsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SETTINGS_COMPANY)) {
    return <p className="text-gray-500">You don&apos;t have permission to view verification settings.</p>;
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
      <div>
        <h1 className="text-2xl font-semibold">Business verification</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit your CAC certificate to get a verified badge on your company. Businesses without a CAC can still
          use the app — a platform admin can approve you to operate without one.
        </p>
      </div>

      <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${status.className}`}>
        <Icon size={16} strokeWidth={2.25} />
        {status.label}
      </div>

      {company.verificationStatus === "REJECTED" && company.verificationNote && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Reason: {company.verificationNote}</p>
      )}

      {company.verificationStatus === "APPROVED_WITHOUT_CAC" && (
        <p className="text-sm text-gray-500">
          A platform admin reviewed this account and approved it to operate without a CAC certificate. You can still
          submit one later if you register.
        </p>
      )}

      {company.verificationStatus === "UNVERIFIED" && deadlinePassed && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your 5-day submission window has passed. You can still submit your certificate below whenever it&apos;s
          ready — nothing about your account is restricted in the meantime.
        </p>
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
