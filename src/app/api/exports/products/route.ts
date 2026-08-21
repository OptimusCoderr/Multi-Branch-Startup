import { requireMembershipOrThrow, computeEffectivePermissions, AuthorizationError } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toCsv, csvFileResponse } from "@/lib/csv";

export async function GET() {
  try {
    const membership = await requireMembershipOrThrow();
    const permissions = await computeEffectivePermissions(membership.membershipId);
    if (!permissions.has(PERMISSIONS.PRODUCTS_VIEW)) {
      throw new AuthorizationError("You don't have permission to export products.");
    }

    const db = getScopedPrisma(membership.companyId);
    const products = await db.product.findMany({
      orderBy: { name: "asc" },
      include: { warehouseStocks: true, branchStocks: true },
    });

    const rows = products.map((p) => {
      const totalStock =
        p.warehouseStocks.reduce((sum, s) => sum + s.quantity, 0) + p.branchStocks.reduce((sum, s) => sum + s.quantity, 0);
      return [
        p.sku,
        p.barcode ?? "",
        p.name,
        p.description ?? "",
        p.unitPrice.toFixed(2),
        p.costPrice?.toFixed(2) ?? "",
        totalStock,
        p.costPrice ? p.costPrice.mul(totalStock).toFixed(2) : "",
        p.isActive ? "Active" : "Inactive",
      ];
    });

    const csv = toCsv(
      ["SKU", "Barcode", "Name", "Description", "Unit price", "Cost price", "Total stock on hand", "Stock value (at cost)", "Status"],
      rows,
    );

    const date = new Date().toISOString().slice(0, 10);
    return csvFileResponse(`products-${membership.companySlug}-${date}.csv`, csv);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return new Response(err.message, { status: 403 });
    }
    throw err;
  }
}
