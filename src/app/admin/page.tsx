import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  TRIAL: "bg-blue-500/20 text-blue-300",
  ACTIVE: "bg-green-500/20 text-green-300",
  SUSPENDED: "bg-red-500/20 text-red-300",
  CANCELLED: "bg-gray-500/20 text-gray-400",
};

const SUBSCRIPTION_STYLES: Record<string, string> = {
  TRIALING: "bg-yellow-500/20 text-yellow-300",
  ACTIVE: "bg-green-500/20 text-green-300",
  PAST_DUE: "bg-amber-500/20 text-amber-300",
  CANCELLED: "bg-red-500/20 text-red-300",
  INCOMPLETE: "bg-gray-500/20 text-gray-400",
};

const VERIFICATION_STYLES: Record<string, string> = {
  UNVERIFIED: "bg-gray-500/20 text-gray-400",
  PENDING_REVIEW: "bg-amber-500/20 text-amber-300",
  VERIFIED: "bg-green-500/20 text-green-300",
  REJECTED: "bg-red-500/20 text-red-300",
  APPROVED_WITHOUT_CAC: "bg-blue-500/20 text-blue-300",
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
      <div>
        <h1 className="text-2xl font-semibold">Companies</h1>
        <p className="mt-1 text-sm text-gray-400">
          {totals.companies} companies · {totals.active} active/trialing · {totals.staff} staff seats total
          {totals.needsAttention > 0 && ` · ${totals.needsAttention} need verification attention`}
        </p>
      </div>

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

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company) => (
              <tr key={company.id} className="border-b border-gray-900 last:border-0">
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    {company.name}
                    {company.verificationStatus === "VERIFIED" && (
                      <ShieldCheck size={14} className="text-green-400" aria-label="Verified" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[company.status] ?? ""}`}>
                    {company.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${VERIFICATION_STYLES[company.verificationStatus] ?? ""}`}>
                    {isOverdue(company) ? "Overdue" : VERIFICATION_LABELS[company.verificationStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {company.subscription
                    ? `${company.subscription.plan.name} (${formatMoney(company.subscription.plan.priceKobo / 100, "NGN")}/mo)`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {company.subscription ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${SUBSCRIPTION_STYLES[company.subscription.status] ?? ""}`}>
                      {company.subscription.status.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-gray-500">No subscription</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-gray-300">{company.memberships.length}</td>
                <td className="px-4 py-3 text-gray-400">{company.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/companies/${company.id}`} className="text-indigo-400 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-4 text-gray-500">No companies match this filter.</p>}
      </div>
    </div>
  );
}
