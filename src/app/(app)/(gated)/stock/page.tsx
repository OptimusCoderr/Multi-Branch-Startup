import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AdjustWarehouseStockForm } from "@/components/forms/adjust-warehouse-stock-form";
import { formatQuantity } from "@/lib/format";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { PackageSearch } from "lucide-react";

export default async function StockPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.STOCK_LEVELS_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view stock levels.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const canAdjust = permissions.has(PERMISSIONS.WAREHOUSES_MANAGE);

  const [products, warehouses, warehouseCount] = await Promise.all([
    // SERVICE products carry no stock rows at all — see
    // Product.productType's schema comment — so they're excluded here
    // entirely rather than showing an always-empty stock breakdown.
    db.product.findMany({
      where: { isActive: true, productType: "GOODS" },
      orderBy: { name: "asc" },
      include: {
        warehouseStocks: { include: { warehouse: true } },
        branchStocks: { include: { branch: true } },
      },
    }),
    canAdjust
      ? db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    // Independent of `canAdjust` — that query above is scoped to a
    // permission, not to whether the company has any warehouses at all,
    // so it can't answer "does this company use warehouses" on its own.
    db.warehouse.count({ where: { isActive: true } }),
  ]);
  const showWarehouseColumn = warehouseCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stock levels" />

      {canAdjust && (
        <AdjustWarehouseStockForm
          products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
          warehouses={warehouses}
        />
      )}

      {products.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No products yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((product) => {
            const totalStock =
              product.warehouseStocks.reduce((sum, s) => sum + s.quantity, 0) +
              product.branchStocks.reduce((sum, s) => sum + s.quantity, 0);
            const isLowStock = product.reorderPoint !== null && totalStock <= product.reorderPoint;

            return (
              <Card key={product.id}>
                <p className="flex items-center gap-2 font-medium">
                  {product.name} <span className="font-mono text-xs text-gray-500 dark:text-gray-400">({product.sku})</span>
                  {isLowStock && (
                    <Badge variant="danger">
                      Low stock ({formatQuantity(totalStock, product.unitLabel)} ≤ {product.reorderPoint})
                    </Badge>
                  )}
                </p>
                <div className={`mt-3 grid grid-cols-1 gap-4 ${showWarehouseColumn ? "sm:grid-cols-2" : ""}`}>
                  {showWarehouseColumn && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Warehouses</p>
                      <ul className="mt-1 flex flex-col gap-1 text-sm">
                        {product.warehouseStocks.length === 0 ? (
                          <li className="text-gray-400 dark:text-gray-500">None</li>
                        ) : (
                          product.warehouseStocks.map((stock) => (
                            <li key={stock.id} className="flex justify-between">
                              <span>{stock.warehouse.name}</span>
                              <span className="font-mono">{formatQuantity(stock.quantity, product.unitLabel)}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Branches</p>
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {product.branchStocks.length === 0 ? (
                        <li className="text-gray-400 dark:text-gray-500">No branches yet</li>
                      ) : (
                        product.branchStocks.map((stock) => (
                          <li key={stock.id} className="flex justify-between">
                            <span>{stock.branch.name}</span>
                            <span className="font-mono">{formatQuantity(stock.quantity, product.unitLabel)}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
