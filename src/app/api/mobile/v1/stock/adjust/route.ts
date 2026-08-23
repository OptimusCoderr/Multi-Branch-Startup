import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { adjustBranchStockSchema } from "@/lib/validation/stock-adjustment.schema";
import { incrementBranchStock, decrementBranchStock, recordStockMovement, InsufficientStockError } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Manual correction to a branch's stock count — the mobile counterpart to
 * the web's warehouse-only adjustWarehouseStock (branches had no manual
 * correction mechanism at all before this). Built for the mobile "stock
 * count" flow: staff scan/tally what's physically on the shelf, and this
 * reconciles the system quantity to match. Gated behind BRANCHES_MANAGE,
 * the same permission the web app's warehouse equivalent uses for the
 * analogous "correcting a location's stock is part of managing it" reason.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.BRANCHES_MANAGE);

    try {
      checkRateLimit(`stock.adjust:${membership.membershipId}`, { max: 200, windowMs: 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = adjustBranchStockSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid adjustment.", 400);
    }
    const { productId, branchId, delta, reason } = parsed.data;

    const db = getScopedPrisma(membership.companyId);

    // Verified here (not just left to updateMany silently matching zero
    // rows) — see the identical reasoning on the web's adjustWarehouseStock
    // and the stock-transfer/expense fixes: a foreign id must never be
    // allowed to reach recordStockMovement/writeAuditLog, or it persists a
    // phantom record referencing another company's product/branch.
    const [product, branch] = await Promise.all([
      db.product.findUnique({ where: { id: productId }, select: { id: true } }),
      db.branch.findUnique({ where: { id: branchId }, select: { id: true } }),
    ]);
    if (!product) throw new ApiError("Product not found.", 404);
    if (!branch) throw new ApiError("Branch not found.", 404);

    await db.$transaction(async (tx) => {
      if (delta > 0) {
        await incrementBranchStock(tx, productId, branchId, delta);
      } else {
        await decrementBranchStock(tx, membership.companyId, productId, branchId, -delta);
      }

      await recordStockMovement(tx, {
        companyId: membership.companyId,
        productId,
        locationType: "BRANCH",
        branchId,
        quantityDelta: delta,
        reason: "ADJUSTMENT",
        referenceType: "ManualAdjustment",
        referenceId: membership.membershipId,
        performedByMembershipId: membership.membershipId,
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "stock.adjusted",
        entityType: "BranchStock",
        entityId: `${productId}:${branchId}`,
        metadata: { productId, branchId, delta, reason: reason ?? null, source: "mobile" },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, [InsufficientStockError]);
  }
}
