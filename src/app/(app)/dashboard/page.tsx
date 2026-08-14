import { requireMembership } from "@/lib/auth/session";

export default async function DashboardPage() {
  const membership = await requireMembership();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Welcome to {membership.companyName}</h1>
      <p className="text-gray-500">
        Products, warehouses, branches, transfers, sales, and staff management land in the
        phases ahead. This dashboard shell confirms sign-up, tenant scoping, and session
        handling are wired up end to end.
      </p>
    </div>
  );
}
