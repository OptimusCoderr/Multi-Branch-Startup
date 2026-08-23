import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui";
import { ProductsPageClient } from "@/components/products/products-page-client";

export default async function ProductsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const [products, branches] = await Promise.all([
    db.product.findMany({ orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Products" />
      <ProductsPageClient
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          description: p.description,
          category: p.category,
          unitLabel: p.unitLabel,
          unitPrice: p.unitPrice.toString(),
          costPrice: p.costPrice?.toString() ?? null,
          reorderPoint: p.reorderPoint?.toString() ?? null,
          tracksBatches: p.tracksBatches,
          isActive: p.isActive,
        }))}
        branches={branches}
        currency={membership.companyCurrency}
        categories={categories}
        canCreate={permissions.has(PERMISSIONS.PRODUCTS_CREATE)}
        canEdit={permissions.has(PERMISSIONS.PRODUCTS_EDIT)}
        canDeactivate={permissions.has(PERMISSIONS.PRODUCTS_DEACTIVATE)}
        canAssignStock={permissions.has(PERMISSIONS.BRANCHES_MANAGE)}
      />
    </div>
  );
}
