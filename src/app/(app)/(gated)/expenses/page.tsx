import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { getExpenseTotalSince, startOfCurrentMonth } from "@/server/services/expense-service";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { archiveExpenseCategory } from "@/server/actions/expenses";
import { ExpenseCategoryForm } from "@/components/forms/expense-category-form";
import { VoidExpenseForm } from "@/components/forms/void-expense-form";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        {canManage && (
          <Link href="/expenses/new" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
            Record expense
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">This month</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(monthTotal.toString(), currency)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Recorded expenses</p>
          <p className="mt-1 text-xl font-semibold">{activeCount}</p>
        </div>
      </div>

      {canManage && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Categories</p>
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
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="text-gray-500">No expenses recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Branch</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Recorded by</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className={`border-b border-gray-100 ${e.voidedAt ? "text-gray-400" : ""}`}>
                  <td className="py-2 pr-4">{e.expenseDate.toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    {e.category.name}
                    {e.isRecurring && <span className="ml-1 text-xs text-gray-400">({e.recurrenceInterval?.toLowerCase()})</span>}
                  </td>
                  <td className="py-2 pr-4">{e.branch?.name ?? "Company-wide"}</td>
                  <td className={`py-2 pr-4 ${e.voidedAt ? "line-through" : ""}`}>{formatMoney(e.amount.toString(), currency)}</td>
                  <td className="py-2 pr-4">{names.get(e.recordedByMembershipId) ?? "Unknown"}</td>
                  <td className="py-2 pr-4">
                    {e.voidedAt ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Voided</span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{canManage && !e.voidedAt && <VoidExpenseForm expenseId={e.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
