"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { productSchema } from "@/lib/validation/product.schema";
import { provisionStockForNewProduct } from "@/server/services/inventory-service";
import { generateProductSku } from "@/lib/sku";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string; success?: boolean };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createProduct(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PRODUCTS_CREATE);

  const parsed = productSchema.safeParse({
    barcode: formData.get("barcode"),
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    unitLabel: formData.get("unitLabel"),
    unitPrice: formData.get("unitPrice"),
    costPrice: formData.get("costPrice"),
    reorderPoint: formData.get("reorderPoint"),
    tracksBatches: formData.get("tracksBatches"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  if (parsed.data.barcode) {
    const barcodeTaken = await db.product.findFirst({ where: { barcode: parsed.data.barcode } });
    if (barcodeTaken) {
      return { error: `A product with barcode "${parsed.data.barcode}" already exists.` };
    }
  }

  await db.$transaction(async (tx) => {
    const sku = await generateProductSku(tx, parsed.data.name);
    const product = await tx.product.create({
      data: {
        companyId: membership.companyId,
        sku,
        barcode: parsed.data.barcode ?? null,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        unitLabel: parsed.data.unitLabel ?? "unit",
        unitPrice: parsed.data.unitPrice,
        costPrice: parsed.data.costPrice ?? null,
        reorderPoint: parsed.data.reorderPoint ?? null,
        tracksBatches: parsed.data.tracksBatches,
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
  return { error: "", success: true };
}

export async function updateProduct(
  productId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PRODUCTS_EDIT);

  const parsed = productSchema.safeParse({
    barcode: formData.get("barcode"),
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    unitLabel: formData.get("unitLabel"),
    unitPrice: formData.get("unitPrice"),
    costPrice: formData.get("costPrice"),
    reorderPoint: formData.get("reorderPoint"),
    tracksBatches: formData.get("tracksBatches"),
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

  if (parsed.data.barcode) {
    const barcodeTaken = await db.product.findFirst({
      where: { barcode: parsed.data.barcode, id: { not: productId } },
    });
    if (barcodeTaken) {
      return { error: `A product with barcode "${parsed.data.barcode}" already exists.` };
    }
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        barcode: parsed.data.barcode ?? null,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        unitLabel: parsed.data.unitLabel ?? "unit",
        unitPrice: parsed.data.unitPrice,
        costPrice: parsed.data.costPrice ?? null,
        reorderPoint: parsed.data.reorderPoint ?? null,
        tracksBatches: parsed.data.tracksBatches,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "product.updated",
      entityType: "Product",
      entityId: updated.id,
      metadata: { sku: updated.sku, before: { name: existing.name }, after: { name: updated.name } },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/products");
  return { error: "", success: true };
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
