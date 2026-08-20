import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createSaleSchema } from "@/lib/validation/sale.schema";
import * as saleService from "@/server/services/sale-service";
import { InsufficientStockError } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

    const db = getScopedPrisma(membership.companyId);
    const sales = await db.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { branch: { select: { name: true } } },
      take: 100,
    });

    return NextResponse.json({
      sales: sales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        branchName: s.branch.name,
        customerName: s.customerName,
        status: s.status,
        grandTotal: s.grandTotal.toString(),
        amountPaid: s.amountPaid.toString(),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Same createSale flow the web /sales/new form uses, reusing the identical service and validation. */
export async function POST(request: Request) {
  try {
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

    try {
      checkRateLimit(`sale.create:${membership.membershipId}`, { max: 120, windowMs: 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid sale details.", 400);
    }

    const db = getScopedPrisma(membership.companyId);
    let saleId = "";

    await db.$transaction(async (tx) => {
      const sale = await saleService.createSale(tx, membership.companyId, membership.membershipId, parsed.data);
      saleId = sale.id;

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "sale.created",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { saleNumber: sale.saleNumber, grandTotal: sale.grandTotal.toString(), source: "mobile" },
      });
    });

    return NextResponse.json({ saleId }, { status: 201 });
  } catch (err) {
    return handleApiError(err, [saleService.SaleValidationError, InsufficientStockError]);
  }
}
