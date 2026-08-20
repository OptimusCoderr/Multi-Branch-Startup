import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, handleApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.STOCK_LEVELS_VIEW);

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
