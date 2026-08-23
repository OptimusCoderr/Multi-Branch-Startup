"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { supplierSchema } from "@/lib/validation/supplier.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createSupplier(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid supplier details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          companyId: membership.companyId,
          name: parsed.data.name,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          address: parsed.data.address ?? null,
          notes: parsed.data.notes ?? null,
        },
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "supplier.created",
        entityType: "Supplier",
        entityId: supplier.id,
        metadata: { name: supplier.name },
        ipAddress,
        userAgent,
      });
    });
  } catch {
    return { error: "A supplier with that name already exists." };
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplier(
  supplierId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid supplier details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!existing) {
    return { error: "Supplier not found." };
  }

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id: supplierId },
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          address: parsed.data.address ?? null,
          notes: parsed.data.notes ?? null,
        },
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "supplier.updated",
        entityType: "Supplier",
        entityId: updated.id,
        metadata: { before: { name: existing.name }, after: { name: updated.name } },
        ipAddress,
        userAgent,
      });
    });
  } catch {
    return { error: "A supplier with that name already exists." };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  redirect("/suppliers");
}

export async function archiveSupplier(supplierId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: existing.isActive ? "supplier.archived" : "supplier.reactivated",
      entityType: "Supplier",
      entityId: supplierId,
      metadata: { name: existing.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
}
