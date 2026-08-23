import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
import { PageHeader } from "@/components/ui";
import { WarehousesPageClient } from "@/components/warehouses/warehouses-page-client";

export default async function WarehousesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const [warehouses, stocks, allProducts, { maxWarehouses }] = await Promise.all([
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    db.warehouseStock.findMany({
      where: { quantity: { gt: 0 } },
      include: { product: { select: { id: true, name: true, sku: true, unitLabel: true, unitPrice: true } } },
      orderBy: { product: { name: "asc" } },
    }),
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    getPlanFeaturesForCompany(membership.companyId),
  ]);

  const stockByWarehouse: Record<string, { productId: string; productName: string; productSku: string; unitLabel: string; unitPrice: string; quantity: number }[]> = {};
  for (const s of stocks) {
    (stockByWarehouse[s.warehouseId] ??= []).push({
      productId: s.product.id,
      productName: s.product.name,
      productSku: s.product.sku,
      unitLabel: s.product.unitLabel,
      unitPrice: s.product.unitPrice.toString(),
      quantity: s.quantity,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Warehouses" />
      <WarehousesPageClient
        warehouses={warehouses}
        stockByWarehouse={stockByWarehouse}
        allProducts={allProducts}
        currency={membership.companyCurrency}
        maxWarehouses={maxWarehouses}
        canManage={permissions.has(PERMISSIONS.WAREHOUSES_MANAGE)}
      />
    </div>
  );
}
