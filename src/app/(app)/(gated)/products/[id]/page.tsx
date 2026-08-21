import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ProductForm } from "@/components/forms/product-form";
import { updateProduct, deactivateProduct } from "@/server/actions/products";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const product = await db.product.findUnique({ where: { id } });
  if (!product) notFound();

  if (!permissions.has(PERMISSIONS.PRODUCTS_EDIT)) {
    return <p className="text-gray-500">You don&apos;t have permission to edit products.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit product</h1>
        {permissions.has(PERMISSIONS.PRODUCTS_DEACTIVATE) && (
          <form action={deactivateProduct.bind(null, product.id)}>
            <button type="submit" className="text-sm text-red-600 hover:underline">
              {product.isActive ? "Deactivate" : "Reactivate"}
            </button>
          </form>
        )}
      </div>
      <ProductForm
        action={updateProduct.bind(null, product.id)}
        defaultValues={{
          sku: product.sku,
          name: product.name,
          description: product.description,
          unitPrice: product.unitPrice.toString(),
          costPrice: product.costPrice?.toString() ?? null,
          reorderPoint: product.reorderPoint?.toString() ?? null,
          tracksBatches: product.tracksBatches,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
