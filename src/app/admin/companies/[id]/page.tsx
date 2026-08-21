import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requirePlatformStaffWithTwoFactor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { formatMoney } from "@/lib/format";
import { getCustomerBalances } from "@/server/services/customer-service";
import { writePlatformAuditLog } from "@/server/services/platform-audit-service";
import { CompanyVerificationReview } from "@/components/forms/company-verification-review";
import { CompanySuspensionControl } from "@/components/forms/company-suspension-control";
import {
  AdminCard,
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

const SALE_STATUS_VARIANTS: Record<string, AdminBadgeVariant> = {
  CONFIRMED: "brand",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  VOIDED: "danger",
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
  const staff = await requirePlatformStaffWithTwoFactor();

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

      <AdminCard>
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
      </AdminCard>

      {staff.role === "SUPER_ADMIN" && (
        <AdminCard>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Account security</h2>
          {company.status === "SUSPENDED" && company.disabledReason && (
            <p className="mb-3 text-sm text-gray-300">Disabled reason: {company.disabledReason}</p>
          )}
          <CompanySuspensionControl companyId={company.id} isSuspended={company.status === "SUSPENDED"} />
        </AdminCard>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AdminCard>
          <p className="text-xs uppercase text-gray-500">Branches</p>
          <p className="mt-1 text-xl font-semibold text-gray-100">{branches.length}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs uppercase text-gray-500">Warehouses</p>
          <p className="mt-1 text-xl font-semibold text-gray-100">{warehouses.length}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs uppercase text-gray-500">Products</p>
          <p className="mt-1 text-xl font-semibold text-gray-100">{productCount}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs uppercase text-gray-500">Staff</p>
          <p className="mt-1 text-xl font-semibold text-gray-100">{memberships.filter((m) => m.status === "ACTIVE").length}</p>
        </AdminCard>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Staff</h2>
        {memberships.length === 0 ? (
          <AdminEmptyState>No staff yet.</AdminEmptyState>
        ) : (
          <AdminTable>
            <AdminTableHeader>
              <AdminTableHeaderCell>Name</AdminTableHeaderCell>
              <AdminTableHeaderCell>Email</AdminTableHeaderCell>
              <AdminTableHeaderCell>Role</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
            </AdminTableHeader>
            <AdminTableBody>
              {memberships.map((m) => (
                <AdminTableRow key={m.id}>
                  <AdminTableCell className="font-medium text-gray-100">{m.displayName ?? m.user.name}</AdminTableCell>
                  <AdminTableCell>{m.user.email}</AdminTableCell>
                  <AdminTableCell>{m.role?.name ?? "—"}</AdminTableCell>
                  <AdminTableCell className="text-gray-400">{m.status}</AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Recent sales</h2>
        {sales.length === 0 ? (
          <AdminEmptyState>No sales yet.</AdminEmptyState>
        ) : (
          <AdminTable>
            <AdminTableHeader>
              <AdminTableHeaderCell>Sale</AdminTableHeaderCell>
              <AdminTableHeaderCell>Branch</AdminTableHeaderCell>
              <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Total</AdminTableHeaderCell>
              <AdminTableHeaderCell>Paid</AdminTableHeaderCell>
              <AdminTableHeaderCell>Date</AdminTableHeaderCell>
            </AdminTableHeader>
            <AdminTableBody>
              {sales.map((sale) => (
                <AdminTableRow key={sale.id}>
                  <AdminTableCell mono>{sale.saleNumber}</AdminTableCell>
                  <AdminTableCell>{sale.branch.name}</AdminTableCell>
                  <AdminTableCell>{sale.customerName ?? "Walk-in"}</AdminTableCell>
                  <AdminTableCell>
                    <AdminBadge variant={SALE_STATUS_VARIANTS[sale.status] ?? "neutral"}>{sale.status}</AdminBadge>
                  </AdminTableCell>
                  <AdminTableCell>{formatMoney(sale.grandTotal.toString(), company.currency)}</AdminTableCell>
                  <AdminTableCell>{formatMoney(sale.amountPaid.toString(), company.currency)}</AdminTableCell>
                  <AdminTableCell className="text-gray-400">{sale.createdAt.toLocaleDateString()}</AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Customers with an outstanding balance</h2>
        {[...balances.values()].every((b) => b.outstanding.lte(0)) ? (
          <AdminEmptyState>No outstanding customer debt.</AdminEmptyState>
        ) : (
          <AdminTable>
            <AdminTableHeader>
              <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
              <AdminTableHeaderCell>Phone</AdminTableHeaderCell>
              <AdminTableHeaderCell>Outstanding</AdminTableHeaderCell>
              <AdminTableHeaderCell>Overdue sales</AdminTableHeaderCell>
            </AdminTableHeader>
            <AdminTableBody>
              {customers
                .map((c) => ({ customer: c, balance: balances.get(c.id) }))
                .filter((row) => row.balance && row.balance.outstanding.gt(0))
                .map(({ customer, balance }) => (
                  <AdminTableRow key={customer.id}>
                    <AdminTableCell className="font-medium text-gray-100">{customer.name}</AdminTableCell>
                    <AdminTableCell>{customer.phone ?? "—"}</AdminTableCell>
                    <AdminTableCell>{formatMoney(balance!.outstanding.toString(), company.currency)}</AdminTableCell>
                    <AdminTableCell className="text-gray-400">{balance!.overdueSaleCount}</AdminTableCell>
                  </AdminTableRow>
                ))}
            </AdminTableBody>
          </AdminTable>
        )}
      </section>
    </div>
  );
}
