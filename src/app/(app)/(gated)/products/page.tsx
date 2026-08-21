import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { deactivateProduct } from "@/server/actions/products";

export default async function ProductsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const products = await db.product.findMany({ orderBy: { name: "asc" } });

  const canCreate = permissions.has(PERMISSIONS.PRODUCTS_CREATE);
  const canEdit = permissions.has(PERMISSIONS.PRODUCTS_EDIT);
  const canDeactivate = permissions.has(PERMISSIONS.PRODUCTS_DEACTIVATE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-3">
          {permissions.has(PERMISSIONS.PRODUCTS_VIEW) && (
            <a href="/api/exports/products" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
              Export CSV
            </a>
          )}
          {canCreate && (
            <Link href="/products/new" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
              New product
            </Link>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">No products yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs">{p.sku}</td>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{formatMoney(p.unitPrice.toString(), membership.companyCurrency)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      {canEdit && (
                        <Link href={`/products/${p.id}`} className="text-[var(--brand-primary)] hover:underline">
                          Edit
                        </Link>
                      )}
                      {canDeactivate && (
                        <form action={deactivateProduct.bind(null, p.id)}>
                          <button type="submit" className="text-red-600 hover:underline">
                            {p.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
