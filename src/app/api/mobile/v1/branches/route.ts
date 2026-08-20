import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    // Reference data for the mobile sale-creation flow — same requirement
    // the web /sales/new page effectively has (it's not separately
    // permission-gated there either, since recording a sale inherently
    // needs to see which branches/products exist to sell from/of).
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

    const db = getScopedPrisma(membership.companyId);
    const branches = await db.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, phone: true },
    });

    return NextResponse.json({ branches });
  } catch (err) {
    return handleApiError(err);
  }
}
