import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AdjustWarehouseStockForm } from "@/components/forms/adjust-warehouse-stock-form";

export default async function StockPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.STOCK_LEVELS_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view stock levels.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const canAdjust = permissions.has(PERMISSIONS.WAREHOUSES_MANAGE);

  const [products, warehouses, warehouseCount] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
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
      <h1 className="text-2xl font-semibold">Stock levels</h1>

      {canAdjust && (
        <AdjustWarehouseStockForm
          products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
          warehouses={warehouses}
        />
      )}

      {products.length === 0 ? (
        <p className="text-gray-500">No products yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {products.map((product) => {
            const totalStock =
              product.warehouseStocks.reduce((sum, s) => sum + s.quantity, 0) +
              product.branchStocks.reduce((sum, s) => sum + s.quantity, 0);
            const isLowStock = product.reorderPoint !== null && totalStock <= product.reorderPoint;

            return (
            <div key={product.id} className="rounded-lg border border-gray-200 p-4">
              <p className="flex items-center gap-2 font-medium">
                {product.name} <span className="font-mono text-xs text-gray-500">({product.sku})</span>
                {isLowStock && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-normal text-red-700">
                    Low stock ({totalStock} ≤ {product.reorderPoint})
                  </span>
                )}
              </p>
              <div className={`mt-3 grid grid-cols-1 gap-4 ${showWarehouseColumn ? "sm:grid-cols-2" : ""}`}>
                {showWarehouseColumn && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-400">Warehouses</p>
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {product.warehouseStocks.length === 0 ? (
                        <li className="text-gray-400">None</li>
                      ) : (
                        product.warehouseStocks.map((stock) => (
                          <li key={stock.id} className="flex justify-between">
                            <span>{stock.warehouse.name}</span>
                            <span className="font-mono">{stock.quantity}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Branches</p>
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {product.branchStocks.length === 0 ? (
                      <li className="text-gray-400">No branches yet</li>
                    ) : (
                      product.branchStocks.map((stock) => (
                        <li key={stock.id} className="flex justify-between">
                          <span>{stock.branch.name}</span>
                          <span className="font-mono">{stock.quantity}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
