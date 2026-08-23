import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CreateSaleForm } from "@/components/forms/create-sale-form";

export default async function NewSalePage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.SALES_RECORD)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to record sales.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const [branches, products, customers] = await Promise.all([
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unitPrice: true, unitLabel: true },
    }),
    db.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
  ]);

  // A sale always belongs to a branch — with none yet (a brand-new company
  // before its first /branches/new visit), the form's required branchId
  // select would just be an empty dropdown, silently blocked by native
  // validation with no indication of what to do. Same fix as
  // /transfers/new got for the zero-warehouse case.
  if (branches.length === 0) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold">Record a sale</h1>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have a branch yet — every sale belongs to one.{" "}
          <Link href="/branches/new" className="text-[var(--brand-primary)] hover:underline">
            Create your first branch
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Record a sale</h1>
      <CreateSaleForm
        branches={branches}
        products={products.map((p) => ({ ...p, unitPrice: p.unitPrice.toString() }))}
        customers={customers}
        currency={membership.companyCurrency}
      />
    </div>
  );
}
