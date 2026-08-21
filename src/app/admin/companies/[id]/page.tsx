import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requirePlatformStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { formatMoney } from "@/lib/format";
import { getCustomerBalances } from "@/server/services/customer-service";
import { writePlatformAuditLog } from "@/server/services/platform-audit-service";
import { CompanyVerificationReview } from "@/components/forms/company-verification-review";
import { CompanySuspensionControl } from "@/components/forms/company-suspension-control";

const SALE_STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-blue-500/20 text-blue-300",
  PARTIALLY_PAID: "bg-amber-500/20 text-amber-300",
  PAID: "bg-green-500/20 text-green-300",
  VOIDED: "bg-red-500/20 text-red-300",
};

const VERIFICATION_LABELS: Record<string, string> = {
  UNVERIFIED: "Unverified",
  PENDING_REVIEW: "Needs review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  APPROVED_WITHOUT_CAC: "Approved without CAC",
};

/**
 * A read-only drill-down into one company's actual operational data for
 * everyone — a deliberate widening of the earlier "summary only" scope, so
 * support staff can diagnose real "why isn't my X showing" issues, not
 * just see that a company exists — plus, for SUPER_ADMIN only, the one
 * place two trust decisions get made: reviewing a business-verification
 * submission, and the account enable/disable kill switch. A SUPPORT_AGENT
 * never sees those controls, only the same read-only data. Every visit is
 * logged to PlatformAuditLog (same discipline as password-reset links and
 * role changes): this is a conscious tenant-isolation exception, and the
 * access itself should be as accountable as any other platform action.
 *
 * getScopedPrisma(id) — not the raw `prisma` singleton — for everything
 * past the initial company lookup, so every query here gets the exact
 * same structural companyId enforcement every other part of the app
 * already relies on, rather than hand-written `where: { companyId }`
 * filters that would be one missed clause away from a cross-tenant leak.
 */
export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requirePlatformStaff();

  const company = await prisma.company.findUnique({
    where: { id },
    include: { subscription: { include: { plan: true } } },
  });
  if (!company) notFound();

  const db = getScopedPrisma(id);
  const [branches, warehouses, memberships, sales, customers, productCount] = await Promise.all([
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    db.membership.findMany({ orderBy: { createdAt: "asc" }, include: { user: true, role: true } }),
    db.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { branch: { select: { name: true } } },
    }),
    db.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.product.count({ where: { isActive: true } }),
  ]);

  const balances = await getCustomerBalances(db, customers.map((c) => c.id));

  await writePlatformAuditLog({
    actorUserId: staff.userId,
    action: "platform.company_data_viewed",
    metadata: { companyId: company.id, companyName: company.name },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="mb-3 flex w-fit items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={14} />
          Companies
        </Link>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {company.status} · {company.subscription ? `${company.subscription.plan.name} plan` : "No subscription"} ·
          Signed up {company.createdAt.toLocaleDateString()}
        </p>
        <p className="mt-1 text-xs text-amber-400/80">
          {staff.role === "SUPER_ADMIN"
            ? "You're viewing this company's data as a super admin, with verification review and account controls below."
            : "Read-only — you're viewing this company's data as a support agent."}{" "}
          This visit is logged.
        </p>
      </div>

      <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Business verification</h2>
        <div className="flex flex-col gap-1 text-sm text-gray-300">
          <p>
            Status: <span className="font-medium text-gray-100">{VERIFICATION_LABELS[company.verificationStatus]}</span>
          </p>
          <p>RC number: {company.rcNumber ?? "—"}</p>
          <p>Incorporation date: {company.incorporationDate ? company.incorporationDate.toLocaleDateString() : "—"}</p>
          <p>
            CAC certificate:{" "}
            {company.cacCertificateUrl ? (
              <a
                href={company.cacCertificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
              >
                Open link <ExternalLink size={12} />
              </a>
            ) : (
              "Not submitted"
            )}
          </p>
          {company.cacSubmittedAt && <p>Submitted: {company.cacSubmittedAt.toLocaleString()}</p>}
          {company.verificationReviewedAt && <p>Last reviewed: {company.verificationReviewedAt.toLocaleString()}</p>}
          {company.verificationNote && <p>Note: {company.verificationNote}</p>}
        </div>

        {staff.role === "SUPER_ADMIN" && (company.verificationStatus === "PENDING_REVIEW" || company.verificationStatus === "UNVERIFIED") && (
          <div className="mt-4 border-t border-gray-800 pt-4">
            <CompanyVerificationReview companyId={company.id} />
          </div>
        )}
      </section>

      {staff.role === "SUPER_ADMIN" && (
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Account security</h2>
          {company.status === "SUSPENDED" && company.disabledReason && (
            <p className="mb-3 text-sm text-gray-300">Disabled reason: {company.disabledReason}</p>
          )}
          <CompanySuspensionControl companyId={company.id} isSuspended={company.status === "SUSPENDED"} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase text-gray-500">Branches</p>
          <p className="mt-1 text-xl font-semibold">{branches.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase text-gray-500">Warehouses</p>
          <p className="mt-1 text-xl font-semibold">{warehouses.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase text-gray-500">Products</p>
          <p className="mt-1 text-xl font-semibold">{productCount}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase text-gray-500">Staff</p>
          <p className="mt-1 text-xl font-semibold">{memberships.filter((m) => m.status === "ACTIVE").length}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Staff</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b border-gray-900 last:border-0">
                  <td className="px-4 py-3 font-medium">{m.displayName ?? m.user.name}</td>
                  <td className="px-4 py-3 text-gray-300">{m.user.email}</td>
                  <td className="px-4 py-3 text-gray-300">{m.role?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberships.length === 0 && <p className="p-4 text-gray-500">No staff yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Recent sales</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
                <th className="px-4 py-3">Sale</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-gray-900 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{sale.saleNumber}</td>
                  <td className="px-4 py-3 text-gray-300">{sale.branch.name}</td>
                  <td className="px-4 py-3 text-gray-300">{sale.customerName ?? "Walk-in"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${SALE_STATUS_STYLES[sale.status] ?? ""}`}>{sale.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{formatMoney(sale.grandTotal.toString(), company.currency)}</td>
                  <td className="px-4 py-3 text-gray-300">{formatMoney(sale.amountPaid.toString(), company.currency)}</td>
                  <td className="px-4 py-3 text-gray-400">{sale.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <p className="p-4 text-gray-500">No sales yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Customers with an outstanding balance</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Overdue sales</th>
              </tr>
            </thead>
            <tbody>
              {customers
                .map((c) => ({ customer: c, balance: balances.get(c.id) }))
                .filter((row) => row.balance && row.balance.outstanding.gt(0))
                .map(({ customer, balance }) => (
                  <tr key={customer.id} className="border-b border-gray-900 last:border-0">
                    <td className="px-4 py-3 font-medium">{customer.name}</td>
                    <td className="px-4 py-3 text-gray-300">{customer.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{formatMoney(balance!.outstanding.toString(), company.currency)}</td>
                    <td className="px-4 py-3 text-gray-400">{balance!.overdueSaleCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {[...balances.values()].every((b) => b.outstanding.lte(0)) && <p className="p-4 text-gray-500">No outstanding customer debt.</p>}
        </div>
      </section>
    </div>
  );
}
