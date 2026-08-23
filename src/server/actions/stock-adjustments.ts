"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { adjustWarehouseStockSchema, adjustBranchStockSchema } from "@/lib/validation/stock-adjustment.schema";
import {
  decrementWarehouseStock,
  incrementWarehouseStock,
  decrementBranchStock,
  incrementBranchStock,
  recordStockMovement,
  InsufficientStockError,
} from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string; success?: boolean };

/**
 * Manual correction to a warehouse's stock count — the on-ramp for initial
 * stock (there is no other way for units to enter a warehouse outside of
 * this and Phase 3's future purchase-receiving flow) and for reconciling
 * shrinkage/damage/miscounts. Gated behind WAREHOUSES_MANAGE rather than a
 * new permission, since correcting a warehouse's stock is part of managing
 * it; still fully audited like every other stock movement.
 */
export async function adjustWarehouseStock(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.WAREHOUSES_MANAGE);

  const parsed = adjustWarehouseStockSchema.safeParse({
    productId: formData.get("productId"),
    warehouseId: formData.get("warehouseId"),
    delta: formData.get("delta"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid adjustment." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for");
  const userAgent = h.get("user-agent");
  const { productId, warehouseId, delta, reason } = parsed.data;

  // Unlike a decrement (guarded by decrementWarehouseStock's row-matched
  // count check), an increment against a foreign productId/warehouseId
  // would otherwise silently update zero real WarehouseStock rows while
  // still writing a StockMovement/AuditLog claiming the adjustment
  // happened — a phantom record, not just a tenant-isolation gap.
  const [product, warehouse] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { id: true } }),
    db.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true } }),
  ]);
  if (!product) return { error: "Product not found." };
  if (!warehouse) return { error: "Warehouse not found." };

  try {
    await db.$transaction(async (tx) => {
      if (delta > 0) {
        await incrementWarehouseStock(tx, productId, warehouseId, delta);
      } else {
        await decrementWarehouseStock(tx, membership.companyId, productId, warehouseId, -delta);
      }

      await recordStockMovement(tx, {
        companyId: membership.companyId,
        productId,
        locationType: "WAREHOUSE",
        warehouseId,
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
        entityType: "WarehouseStock",
        entityId: `${productId}:${warehouseId}`,
        metadata: { productId, warehouseId, delta, reason: reason ?? null },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { error: err.message };
    }
    return { error: "Could not adjust stock." };
  }

  revalidatePath("/warehouses");
  return { error: "", success: true };
}

/**
 * Manual correction to a branch's stock count — the web counterpart to
 * adjustWarehouseStock above, and to the mobile app's identical
 * /api/mobile/v1/stock/adjust route (same adjustBranchStockSchema, same
 * decrementBranchStock/incrementBranchStock calls). Gated behind
 * BRANCHES_MANAGE for the same "correcting a location's stock is part of
 * managing it" reason WAREHOUSES_MANAGE gates the warehouse version.
 */
export async function adjustBranchStock(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.BRANCHES_MANAGE);

  const parsed = adjustBranchStockSchema.safeParse({
    productId: formData.get("productId"),
    branchId: formData.get("branchId"),
    delta: formData.get("delta"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid adjustment." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for");
  const userAgent = h.get("user-agent");
  const { productId, branchId, delta, reason } = parsed.data;

  // Same reasoning as adjustWarehouseStock: verify the ids are real,
  // tenant-scoped rows before touching anything, so a foreign id can't
  // silently write a phantom StockMovement/AuditLog entry.
  const [product, branch] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { id: true } }),
    db.branch.findUnique({ where: { id: branchId }, select: { id: true } }),
  ]);
  if (!product) return { error: "Product not found." };
  if (!branch) return { error: "Branch not found." };

  try {
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
        metadata: { productId, branchId, delta, reason: reason ?? null },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { error: err.message };
    }
    return { error: "Could not adjust stock." };
  }

  revalidatePath("/branches");
  revalidatePath("/products");
  revalidatePath("/branch-stock");
  return { error: "", success: true };
}
