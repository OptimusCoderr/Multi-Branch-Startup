"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { productSchema } from "@/lib/validation/product.schema";
import { provisionStockForNewProduct } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createProduct(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PRODUCTS_CREATE);

  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
    costPrice: formData.get("costPrice"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.product.findFirst({ where: { sku: parsed.data.sku } });
  if (existing) {
    return { error: `A product with SKU "${parsed.data.sku}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        companyId: membership.companyId,
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unitPrice: parsed.data.unitPrice,
        costPrice: parsed.data.costPrice ?? null,
      },
    });

    await provisionStockForNewProduct(tx, membership.companyId, product.id);

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      metadata: { sku: product.sku, name: product.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  productId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PRODUCTS_EDIT);

  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
    costPrice: formData.get("costPrice"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) {
    return { error: "Product not found." };
  }

  const skuTaken = await db.product.findFirst({
    where: { sku: parsed.data.sku, id: { not: productId } },
  });
  if (skuTaken) {
    return { error: `A product with SKU "${parsed.data.sku}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unitPrice: parsed.data.unitPrice,
        costPrice: parsed.data.costPrice ?? null,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "product.updated",
      entityType: "Product",
      entityId: updated.id,
      metadata: { before: { sku: existing.sku, name: existing.name }, after: { sku: updated.sku, name: updated.name } },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function deactivateProduct(productId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PRODUCTS_DEACTIVATE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: existing.isActive ? "product.deactivated" : "product.reactivated",
      entityType: "Product",
      entityId: productId,
      metadata: { sku: existing.sku },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/products");
}
