import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getCustomerBalance } from "@/server/services/customer-service";
import { CustomerForm } from "@/components/forms/customer-form";
import { updateCustomer, archiveCustomer } from "@/server/actions/customers";
import {
  Card,
  Badge,
  Button,
  LinkButton,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  type BadgeVariant,
} from "@/components/ui";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  CONFIRMED: "warning",
  PARTIALLY_PAID: "brand",
  PAID: "success",
  VOIDED: "neutral",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.CUSTOMERS_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view customers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [balance, sales, reminders] = await Promise.all([
    getCustomerBalance(db, customer.id),
    db.sale.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: { branch: true },
      take: 50,
    }),
    db.debtReminder.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const canManage = permissions.has(PERMISSIONS.CUSTOMERS_MANAGE);
  const now = new Date();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{customer.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {customer.phone ?? "No phone"} {customer.email ? `· ${customer.email}` : ""}
          </p>
        </div>
        {canManage && (
          <form action={archiveCustomer.bind(null, customer.id)}>
            <Button type="submit" variant="danger-link">
              {customer.isActive ? "Archive" : "Reactivate"}
            </Button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Outstanding balance</p>
          <p className={`mt-1 text-xl font-semibold ${balance.outstanding.gt(0) ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {formatMoney(balance.outstanding.toString(), currency)}
          </p>
          {balance.overdueSaleCount > 0 && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{balance.overdueSaleCount} sale(s) overdue</p>
          )}
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Open sales</p>
          <p className="mt-1 text-xl font-semibold">{balance.openSaleCount}</p>
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Sales history</p>
        {sales.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No sales linked to this customer yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Branch</TableHeaderCell>
              <TableHeaderCell>Total</TableHeaderCell>
              <TableHeaderCell>Outstanding</TableHeaderCell>
              <TableHeaderCell>Due</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell align="right"></TableHeaderCell>
            </TableHeader>
            <TableBody>
              {sales.map((s) => {
                const outstanding = s.grandTotal.sub(s.amountPaid);
                const overdue = outstanding.gt(0) && s.dueDate && s.dueDate < now;
                return (
                  <TableRow key={s.id}>
                    <TableCell mono>{s.saleNumber}</TableCell>
                    <TableCell>{s.branch.name}</TableCell>
                    <TableCell>{formatMoney(s.grandTotal.toString(), currency)}</TableCell>
                    <TableCell>
                      {outstanding.gt(0) ? (
                        <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}>
                          {formatMoney(outstanding.toString(), currency)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">{s.dueDate ? s.dueDate.toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[s.status] ?? "neutral"}>{s.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell align="right">
                      <LinkButton href={`/sales/${s.id}`} variant="link">
                        View
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {reminders.length > 0 && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Reminder history</p>
          <ul className="flex flex-col gap-1 text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  {r.createdAt.toLocaleString()} · {formatMoney(r.outstandingSnapshot.toString(), currency)}
                </span>
                <Badge variant={r.status === "SENT" ? "success" : "danger"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-gray-100">Edit customer</h2>
          <CustomerForm
            action={updateCustomer.bind(null, customer.id)}
            defaultValues={{
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              notes: customer.notes,
              creditLimit: customer.creditLimit?.toString() ?? null,
              remindersEnabled: customer.remindersEnabled,
            }}
            submitLabel="Save changes"
          />
        </div>
      )}
    </div>
  );
}
