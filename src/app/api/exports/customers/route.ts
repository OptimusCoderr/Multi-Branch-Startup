import { requireMembershipOrThrow, computeEffectivePermissions, AuthorizationError } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toCsv, csvFileResponse } from "@/lib/csv";
import { getCustomerBalances } from "@/server/services/customer-service";

export async function GET() {
  try {
    const membership = await requireMembershipOrThrow();
    const permissions = await computeEffectivePermissions(membership.membershipId);
    if (!permissions.has(PERMISSIONS.CUSTOMERS_VIEW)) {
      throw new AuthorizationError("You don't have permission to export customers.");
    }

    const db = getScopedPrisma(membership.companyId);
    const customers = await db.customer.findMany({ orderBy: { name: "asc" } });
    const balances = await getCustomerBalances(
      db,
      customers.map((c) => c.id),
    );

    const rows = customers.map((c) => {
      const balance = balances.get(c.id);
      return [
        c.name,
        c.phone ?? "",
        c.email ?? "",
        c.address ?? "",
        c.creditLimit?.toFixed(2) ?? "",
        balance?.outstanding.toFixed(2) ?? "0.00",
        balance?.openSaleCount ?? 0,
        balance?.overdueSaleCount ?? 0,
        c.isActive ? "Active" : "Archived",
      ];
    });

    const csv = toCsv(
      ["Name", "Phone", "Email", "Address", "Credit limit", "Outstanding balance", "Open sales", "Overdue sales", "Status"],
      rows,
    );

    const date = new Date().toISOString().slice(0, 10);
    return csvFileResponse(`customers-${membership.companySlug}-${date}.csv`, csv);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return new Response(err.message, { status: 403 });
    }
    throw err;
  }
}
