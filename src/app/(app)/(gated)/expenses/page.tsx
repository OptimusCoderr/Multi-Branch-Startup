import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getExpenseTotalSince, startOfCurrentMonth } from "@/server/services/expense-service";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { archiveExpenseCategory } from "@/server/actions/expenses";
import { ExpenseCategoryForm } from "@/components/forms/expense-category-form";
import { VoidExpenseForm } from "@/components/forms/void-expense-form";
import {
  PageHeader,
  StatCard,
  LinkButton,
  Card,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
} from "@/components/ui";
import { Wallet, Receipt } from "lucide-react";

export default async function ExpensesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.EXPENSES_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view expenses.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;
  const canManage = permissions.has(PERMISSIONS.EXPENSES_MANAGE);

  const [categories, expenses, monthTotal] = await Promise.all([
    db.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    db.expense.findMany({
      orderBy: { expenseDate: "desc" },
      include: { category: true, branch: true },
      take: 100,
    }),
    getExpenseTotalSince(db, startOfCurrentMonth()),
  ]);

  const names = await resolveMembershipNames(
    db,
    expenses.flatMap((e) => [e.recordedByMembershipId, e.voidedByMembershipId]),
  );

  const activeCount = expenses.filter((e) => !e.voidedAt).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Expenses" actions={canManage && <LinkButton href="/expenses/new">Record expense</LinkButton>} />

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Wallet} label="This month" value={formatMoney(monthTotal.toString(), currency)} tint="var(--brand-primary)" />
        <StatCard icon={Receipt} label="Recorded expenses" value={String(activeCount)} tint="#6b7280" />
      </div>

      {canManage && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Categories</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs ${
                  c.isActive ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-400 line-through"
                }`}
              >
                {c.name}
                <form action={archiveExpenseCategory.bind(null, c.id)}>
                  <button type="submit" className="text-gray-400 hover:text-red-600">
                    {c.isActive ? "×" : "↺"}
                  </button>
                </form>
              </span>
            ))}
          </div>
          <ExpenseCategoryForm />
        </Card>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses recorded yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>Branch</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
            <TableHeaderCell>Recorded by</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id} className={e.voidedAt ? "text-gray-400" : ""}>
                <TableCell>{e.expenseDate.toLocaleDateString()}</TableCell>
                <TableCell>
                  {e.category.name}
                  {e.isRecurring && <span className="ml-1 text-xs text-gray-400">({e.recurrenceInterval?.toLowerCase()})</span>}
                </TableCell>
                <TableCell>{e.branch?.name ?? "Company-wide"}</TableCell>
                <TableCell className={e.voidedAt ? "line-through" : ""}>{formatMoney(e.amount.toString(), currency)}</TableCell>
                <TableCell>{names.get(e.recordedByMembershipId) ?? "Unknown"}</TableCell>
                <TableCell>
                  <Badge variant={e.voidedAt ? "neutral" : "success"}>{e.voidedAt ? "Voided" : "Active"}</Badge>
                </TableCell>
                <TableCell align="right">{canManage && !e.voidedAt && <VoidExpenseForm expenseId={e.id} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
