import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePlatformStaffWithTwoFactor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";
import {
  AdminPageHeader,
  AdminBadge,
  AdminTable,
  AdminTableHeader,
  AdminTableHeaderCell,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
  AdminEmptyState,
  type AdminBadgeVariant,
} from "@/components/ui-admin";

const STATUS_VARIANTS: Record<string, AdminBadgeVariant> = {
  TRIAL: "brand",
  ACTIVE: "success",
  SUSPENDED: "danger",
  CANCELLED: "neutral",
};

const SUBSCRIPTION_VARIANTS: Record<string, AdminBadgeVariant> = {
  TRIALING: "warning",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "danger",
  INCOMPLETE: "neutral",
};

const VERIFICATION_VARIANTS: Record<string, AdminBadgeVariant> = {
  UNVERIFIED: "neutral",
  PENDING_REVIEW: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  APPROVED_WITHOUT_CAC: "brand",
};

const VERIFICATION_LABELS: Record<string, string> = {
  UNVERIFIED: "Unverified",
  PENDING_REVIEW: "Needs review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  APPROVED_WITHOUT_CAC: "Approved w/o CAC",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending_review", label: "Needs review" },
  { key: "overdue", label: "Overdue" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "disabled", label: "Disabled" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/**
 * Deliberately read-only: every value here comes straight off Company /
 * Subscription / counts, with no mutation affordance anywhere on this page.
 * Each row links to /admin/companies/[id] for a deeper (still read-only for
 * SUPPORT_AGENT, mutable for SUPER_ADMIN) look at that company's actual
 * data, including business-verification review and the enable/disable
 * switch — a deliberate, logged tenant-isolation exception for support
 * purposes, not something available from this summary list itself.
 */
export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePlatformStaffWithTwoFactor();
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as FilterKey) : "all";

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { branches: true, warehouses: true } },
      memberships: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });

  const now = new Date();
  const isOverdue = (c: (typeof companies)[number]) =>
    c.verificationStatus === "UNVERIFIED" && c.verificationDeadline !== null && c.verificationDeadline < now;

  const filtered = companies.filter((c) => {
    switch (filter) {
      case "pending_review":
        return c.verificationStatus === "PENDING_REVIEW";
      case "overdue":
        return isOverdue(c);
      case "verified":
        return c.verificationStatus === "VERIFIED";
      case "rejected":
        return c.verificationStatus === "REJECTED";
      case "disabled":
        return c.status === "SUSPENDED";
      default:
        return true;
    }
  });

  const totals = {
    companies: companies.length,
    active: companies.filter((c) => c.status === "ACTIVE" || c.status === "TRIAL").length,
    staff: companies.reduce((sum, c) => sum + c.memberships.length, 0),
    needsAttention: companies.filter((c) => c.verificationStatus === "PENDING_REVIEW" || isOverdue(c)).length,
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Companies"
        description={`${totals.companies} companies · ${totals.active} active/trialing · ${totals.staff} staff seats total${
          totals.needsAttention > 0 ? ` · ${totals.needsAttention} need verification attention` : ""
        }`}
      />

      <nav className="flex flex-wrap gap-1 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin" : `/admin?filter=${f.key}`}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              filter === f.key ? "bg-indigo-500/20 text-indigo-300" : "text-gray-400 hover:bg-gray-900 hover:text-white"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <AdminEmptyState>No companies match this filter.</AdminEmptyState>
      ) : (
        <AdminTable>
          <AdminTableHeader>
            <AdminTableHeaderCell>Company</AdminTableHeaderCell>
            <AdminTableHeaderCell>Status</AdminTableHeaderCell>
            <AdminTableHeaderCell>Verification</AdminTableHeaderCell>
            <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
            <AdminTableHeaderCell>Subscription</AdminTableHeaderCell>
            <AdminTableHeaderCell>Staff</AdminTableHeaderCell>
            <AdminTableHeaderCell>Signed up</AdminTableHeaderCell>
            <AdminTableHeaderCell align="right"></AdminTableHeaderCell>
          </AdminTableHeader>
          <AdminTableBody>
            {filtered.map((company) => (
              <AdminTableRow key={company.id}>
                <AdminTableCell className="font-medium text-gray-100">
                  <span className="flex items-center gap-1.5">
                    {company.name}
                    {company.verificationStatus === "VERIFIED" && (
                      <ShieldCheck size={14} className="text-green-400" aria-label="Verified" />
                    )}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <AdminBadge variant={STATUS_VARIANTS[company.status] ?? "neutral"}>{company.status}</AdminBadge>
                </AdminTableCell>
                <AdminTableCell>
                  <AdminBadge variant={VERIFICATION_VARIANTS[company.verificationStatus] ?? "neutral"}>
                    {isOverdue(company) ? "Overdue" : VERIFICATION_LABELS[company.verificationStatus]}
                  </AdminBadge>
                </AdminTableCell>
                <AdminTableCell>
                  {company.subscription
                    ? `${company.subscription.plan.name} (${formatMoney(company.subscription.plan.priceKobo / 100, "NGN")}/mo)`
                    : "—"}
                </AdminTableCell>
                <AdminTableCell>
                  {company.subscription ? (
                    <AdminBadge variant={SUBSCRIPTION_VARIANTS[company.subscription.status] ?? "neutral"}>
                      {company.subscription.status.replace("_", " ")}
                    </AdminBadge>
                  ) : (
                    <span className="text-gray-500">No subscription</span>
                  )}
                </AdminTableCell>
                <AdminTableCell mono>{company.memberships.length}</AdminTableCell>
                <AdminTableCell className="text-gray-400">{company.createdAt.toLocaleDateString()}</AdminTableCell>
                <AdminTableCell align="right">
                  <Link href={`/admin/companies/${company.id}`} className="text-indigo-400 hover:underline">
                    View
                  </Link>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  );
}
