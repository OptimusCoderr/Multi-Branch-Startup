import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ProductForm } from "@/components/forms/product-form";
import { createProduct } from "@/server/actions/products";
import { PageHeader } from "@/components/ui";

export default async function NewProductPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PRODUCTS_CREATE)) {
    return <p className="text-gray-500">You don&apos;t have permission to create products.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader title="New product" />
      <ProductForm action={createProduct} submitLabel="Create product" />
    </div>
  );
}
