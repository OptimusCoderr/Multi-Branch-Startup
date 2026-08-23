"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createPurchaseOrderSchema, receivePurchaseOrderLineItemSchema } from "@/lib/validation/purchase-order.schema";
import * as purchaseOrderService from "@/server/services/purchase-order-service";
import { BatchRequiredError } from "@/server/services/transfer-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (
    err instanceof purchaseOrderService.PurchaseOrderStateError ||
    err instanceof purchaseOrderService.PurchaseOrderNotFoundError ||
    err instanceof BatchRequiredError
  ) {
    return err.message;
  }
  return fallback;
}

export async function createPurchaseOrder(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  let lineItems: unknown;
  try {
    lineItems = JSON.parse(String(formData.get("lineItems") ?? "[]"));
  } catch {
    return { error: "Invalid line items." };
  }

  const parsed = createPurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    destinationType: formData.get("destinationType"),
    destinationWarehouseId: formData.get("destinationWarehouseId"),
    destinationBranchId: formData.get("destinationBranchId"),
    expectedDate: formData.get("expectedDate"),
    notes: formData.get("notes"),
    lineItems,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();
  let purchaseOrderId = "";

  const destination =
    parsed.data.destinationType === "WAREHOUSE"
      ? { destinationWarehouseId: parsed.data.destinationWarehouseId! }
      : { destinationBranchId: parsed.data.destinationBranchId! };

  try {
    await db.$transaction(async (tx) => {
      const po = await purchaseOrderService.createPurchaseOrder(tx, membership.companyId, membership.membershipId, {
        supplierId: parsed.data.supplierId,
        expectedDate: parsed.data.expectedDate,
        notes: parsed.data.notes,
        lineItems: parsed.data.lineItems,
        ...destination,
      });
      purchaseOrderId = po.id;

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "purchase_order.created",
        entityType: "PurchaseOrder",
        entityId: po.id,
        metadata: { poNumber: po.poNumber, lineItemCount: parsed.data.lineItems.length },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not create the purchase order.") };
  }

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${purchaseOrderId}`);
}

export async function markPurchaseOrderOrdered(purchaseOrderId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const po = await purchaseOrderService.markPurchaseOrderOrdered(tx, membership.membershipId, purchaseOrderId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "purchase_order.ordered",
      entityType: "PurchaseOrder",
      entityId: po.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
  revalidatePath("/purchase-orders");
}

export async function cancelPurchaseOrder(purchaseOrderId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const po = await purchaseOrderService.cancelPurchaseOrder(tx, membership.membershipId, purchaseOrderId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "purchase_order.cancelled",
      entityType: "PurchaseOrder",
      entityId: po.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
  revalidatePath("/purchase-orders");
}

export async function receivePurchaseOrderLineItem(
  purchaseOrderId: string,
  lineItemId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PURCHASE_ORDERS_RECEIVE);

  const parsed = receivePurchaseOrderLineItemSchema.safeParse({
    quantityReceived: formData.get("quantityReceived"),
    batchNumber: formData.get("batchNumber"),
    expiryDate: formData.get("expiryDate"),
    manufactureDate: formData.get("manufactureDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid received quantity." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const batch =
    parsed.data.batchNumber && parsed.data.expiryDate
      ? { batchNumber: parsed.data.batchNumber, expiryDate: parsed.data.expiryDate, manufactureDate: parsed.data.manufactureDate }
      : undefined;

  try {
    await db.$transaction(async (tx) => {
      const { lineItem, purchaseOrder } = await purchaseOrderService.receivePurchaseOrderLineItem(
        tx,
        membership.companyId,
        membership.membershipId,
        lineItemId,
        parsed.data.quantityReceived,
        batch,
      );

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "purchase_order.line_item_received",
        entityType: "PurchaseOrder",
        entityId: purchaseOrder.id,
        metadata: { lineItemId: lineItem.id, quantityReceived: parsed.data.quantityReceived },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not record the receipt.") };
  }

  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${purchaseOrderId}`);
}
