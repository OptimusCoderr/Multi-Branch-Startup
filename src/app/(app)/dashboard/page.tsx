import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { getSubscriptionForCompany, isSubscriptionActive } from "@/lib/billing/subscription-gate";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";

export default async function DashboardPage() {
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const [subscription, branchCount, warehouseCount] = await Promise.all([
    getSubscriptionForCompany(membership.companyId),
    db.branch.count({ where: { isActive: true } }),
    db.warehouse.count({ where: { isActive: true } }),
  ]);
  const active = isSubscriptionActive(subscription);

  // Same copy for everyone reads like a checklist of features a
  // single-branch, no-warehouse shop doesn't have and doesn't need —
  // describe what this company is actually set up to do instead.
  const managed = [
    "products",
    branchCount > 1 ? "branches" : "your branch",
    ...(warehouseCount > 0 ? ["warehouses", "stock transfers"] : []),
    "sales",
    "staff",
  ];
  const summary = managed.length > 1 ? `${managed.slice(0, -1).join(", ")}, and ${managed.at(-1)}` : managed[0];

  return (
    <div className="flex flex-col gap-4">
      {!active && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your subscription needs attention — access to products, sales, and other features is
          restricted until this is resolved.{" "}
          <Link href="/settings/billing" className="font-medium underline">
            Review billing
          </Link>
        </div>
      )}
      {active && subscription?.status === "TRIALING" && subscription.trialEndsAt && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          You&apos;re on a free trial until {subscription.trialEndsAt.toLocaleDateString()}.{" "}
          <Link href="/settings/billing" className="font-medium underline">
            Add a plan
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-semibold">Welcome to {membership.companyName}</h1>
      <p className="text-gray-500">Manage {summary} from the navigation above.</p>
    </div>
  );
}
