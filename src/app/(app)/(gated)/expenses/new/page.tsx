import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ExpenseForm } from "@/components/forms/expense-form";

export default async function NewExpensePage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.EXPENSES_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to record expenses.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [categories, branches] = await Promise.all([
    db.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (categories.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-3">
        <h1 className="text-2xl font-semibold">Record expense</h1>
        <p className="text-gray-500 dark:text-gray-400">
          No expense categories yet.{" "}
          <Link href="/expenses" className="text-[var(--brand-primary)] hover:underline">
            Add one first
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">Record expense</h1>
      <ExpenseForm categories={categories} branches={branches} />
    </div>
  );
}
