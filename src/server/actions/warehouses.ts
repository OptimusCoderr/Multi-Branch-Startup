"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { warehouseSchema } from "@/lib/validation/location.schema";
import { provisionStockForNewWarehouse } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createWarehouse(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.WAREHOUSES_MANAGE);

  const parsed = warehouseSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid warehouse details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.warehouse.findFirst({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: `A warehouse named "${parsed.data.name}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.create({
      data: { companyId: membership.companyId, name: parsed.data.name, address: parsed.data.address ?? null },
    });

    await provisionStockForNewWarehouse(tx, membership.companyId, warehouse.id);

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "warehouse.created",
      entityType: "Warehouse",
      entityId: warehouse.id,
      metadata: { name: warehouse.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export async function updateWarehouse(
  warehouseId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.WAREHOUSES_MANAGE);

  const parsed = warehouseSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid warehouse details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!existing) {
    return { error: "Warehouse not found." };
  }

  const nameTaken = await db.warehouse.findFirst({
    where: { name: parsed.data.name, id: { not: warehouseId } },
  });
  if (nameTaken) {
    return { error: `A warehouse named "${parsed.data.name}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.warehouse.update({
      where: { id: warehouseId },
      data: { name: parsed.data.name, address: parsed.data.address ?? null },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "warehouse.updated",
      entityType: "Warehouse",
      entityId: updated.id,
      metadata: { before: { name: existing.name }, after: { name: updated.name } },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export async function deactivateWarehouse(warehouseId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.WAREHOUSES_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.warehouse.update({
      where: { id: warehouseId },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: existing.isActive ? "warehouse.deactivated" : "warehouse.reactivated",
      entityType: "Warehouse",
      entityId: warehouseId,
      metadata: { name: existing.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/warehouses");
}
