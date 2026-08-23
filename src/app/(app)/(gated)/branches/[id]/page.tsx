import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { LocationForm } from "@/components/forms/location-form";
import { AdjustBranchStockForm } from "@/components/forms/adjust-branch-stock-form";
import { updateBranch, deactivateBranch } from "@/server/actions/branches";
import { getLowStockProducts } from "@/server/services/inventory-service";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Badge, EmptyState } from "@/components/ui";
import { PackageSearch } from "lucide-react";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const branch = await db.branch.findUnique({ where: { id } });
  if (!branch) notFound();

  if (!permissions.has(PERMISSIONS.BRANCHES_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to edit branches.</p>;
  }

  const [stocks, allProducts, lowStock] = await Promise.all([
    db.branchStock.findMany({
      where: { branchId: id },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    }),
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    getLowStockProducts(db),
  ]);
  const lowStockProductIds = new Set(lowStock.map((p) => p.productId));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit branch</h1>
        <form action={deactivateBranch.bind(null, branch.id)}>
          <button type="submit" className="text-sm text-red-600 dark:text-red-400 hover:underline">
            {branch.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </div>
      <div className="max-w-lg">
        <LocationForm
          action={updateBranch.bind(null, branch.id)}
          defaultValues={{ name: branch.name, address: branch.address, phone: branch.phone }}
          submitLabel="Save changes"
          showPhone
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Stock at {branch.name}</h2>
        {stocks.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No products yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Product</TableHeaderCell>
              <TableHeaderCell>Qty</TableHeaderCell>
              <TableHeaderCell>Unit price</TableHeaderCell>
              <TableHeaderCell>Value</TableHeaderCell>
              <TableHeaderCell />
            </TableHeader>
            <TableBody>
              {stocks.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.product.name} <span className="font-mono text-xs text-gray-500 dark:text-gray-400">({s.product.sku})</span>
                  </TableCell>
                  <TableCell mono>{formatQuantity(s.quantity, s.product.unitLabel)}</TableCell>
                  <TableCell mono>{formatMoney(s.product.unitPrice.toString(), membership.companyCurrency)}</TableCell>
                  <TableCell mono>{formatMoney(s.product.unitPrice.mul(s.quantity).toString(), membership.companyCurrency)}</TableCell>
                  <TableCell>{lowStockProductIds.has(s.productId) && <Badge variant="danger">Low</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="max-w-lg">
        <h2 className="mb-3 text-lg font-semibold">Add / update stock</h2>
        <AdjustBranchStockForm products={allProducts} branches={[{ id: branch.id, name: branch.name }]} />
      </div>
    </div>
  );
}
