import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma, Prisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getCustomerBalances } from "@/server/services/customer-service";
import { archiveCustomer } from "@/server/actions/customers";
import { SendRemindersButton } from "@/components/forms/send-reminders-button";
import {
  PageHeader,
  StatCard,
  LinkButton,
  Button,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
} from "@/components/ui";
import { Wallet, Users, AlertTriangle, FileDown } from "lucide-react";

export default async function CustomersPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.CUSTOMERS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view customers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const [customers, company] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.company.findUnique({ where: { id: membership.companyId } }),
  ]);
  const balances = await getCustomerBalances(db, customers.map((c) => c.id));

  const totalOutstanding = [...balances.values()].reduce((sum, b) => sum.add(b.outstanding), new Prisma.Decimal(0));

  const canCreate = permissions.has(PERMISSIONS.CUSTOMERS_MANAGE);
  const debtorCount = [...balances.values()].filter((b) => b.outstanding.gt(0)).length;
  const overdueCount = [...balances.values()].filter((b) => b.overdueSaleCount > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        actions={
          <>
            <a
              href="/api/exports/customers"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              <FileDown size={14} /> Export CSV
            </a>
            {canCreate && <LinkButton href="/customers/new">New customer</LinkButton>}
          </>
        }
      />

      {canCreate &&
        (company?.debtReminderEnabled ? (
          <SendRemindersButton />
        ) : (
          <p className="text-sm text-gray-500">
            Automated debt reminders are off.{" "}
            <Link href="/settings/debt-reminders" className="text-[var(--brand-primary)] hover:underline">
              Turn them on
            </Link>
            .
          </p>
        ))}

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Wallet} label="Total outstanding" value={formatMoney(totalOutstanding.toString(), currency)} tint="#d97706" />
        <StatCard icon={Users} label="Debtors" value={String(debtorCount)} tint="var(--brand-primary)" />
        <StatCard icon={AlertTriangle} label="Overdue" value={String(overdueCount)} tint="#dc2626" />
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Outstanding</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const balance = balances.get(c.id);
              const overdue = (balance?.overdueSaleCount ?? 0) > 0;
              return (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-gray-500">{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {balance && balance.outstanding.gt(0) ? (
                      <span className={overdue ? "font-medium text-red-600" : "font-medium text-amber-700"}>
                        {formatMoney(balance.outstanding.toString(), currency)}
                        {overdue ? " (overdue)" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Archived"}</Badge>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-3">
                      <LinkButton href={`/customers/${c.id}`} variant="link">
                        View
                      </LinkButton>
                      {canCreate && (
                        <form action={archiveCustomer.bind(null, c.id)}>
                          <Button type="submit" variant="danger-link">
                            {c.isActive ? "Archive" : "Reactivate"}
                          </Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
