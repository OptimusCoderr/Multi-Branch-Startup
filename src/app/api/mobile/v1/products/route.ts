import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    // Reference data for the mobile sale-creation flow — see branches/route.ts.
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

    const db = getScopedPrisma(membership.companyId);
    const products = await db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, sku: true, barcode: true, name: true, description: true, unitPrice: true, unitLabel: true },
    });

    return NextResponse.json({
      products: products.map((p) => ({ ...p, unitPrice: p.unitPrice.toString() })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
