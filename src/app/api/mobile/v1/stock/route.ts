import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, handleApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.STOCK_LEVELS_VIEW);

    const db = getScopedPrisma(membership.companyId);
    const products = await db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        warehouseStocks: { include: { warehouse: { select: { id: true, name: true } } } },
        branchStocks: { include: { branch: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        warehouseStocks: p.warehouseStocks.map((s) => ({ warehouseId: s.warehouseId, warehouseName: s.warehouse.name, quantity: s.quantity })),
        branchStocks: p.branchStocks.map((s) => ({ branchId: s.branchId, branchName: s.branch.name, quantity: s.quantity })),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
