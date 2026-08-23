import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CustomerForm } from "@/components/forms/customer-form";
import { createCustomer } from "@/server/actions/customers";

export default async function NewCustomerPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.CUSTOMERS_MANAGE)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to create customers.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New customer</h1>
      <CustomerForm action={createCustomer} submitLabel="Create customer" />
    </div>
  );
}
