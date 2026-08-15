import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ProductForm } from "@/components/forms/product-form";
import { createProduct } from "@/server/actions/products";

export default async function NewProductPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PRODUCTS_CREATE)) {
    return <p className="text-gray-500">You don&apos;t have permission to create products.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductForm action={createProduct} submitLabel="Create product" />
    </div>
  );
}
