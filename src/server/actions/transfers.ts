"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  requestTransferSchema,
  resolveTransferSchema,
  rejectTransferSchema,
  receiveTransferSchema,
  receiveExternalSchema,
} from "@/lib/validation/transfer.schema";
import * as transferService from "@/server/services/transfer-service";
import { InsufficientStockError } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { createNotifications, getOwnerAndAdminMembershipIds } from "@/server/services/notification-service";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

type ActionResult = { error: string; success?: boolean };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (
    err instanceof transferService.TransferStateError ||
    err instanceof transferService.TransferNotFoundError ||
    err instanceof transferService.BatchRequiredError ||
    err instanceof InsufficientStockError
  ) {
    return err.message;
  }
  return fallback;
}

export async function requestTransfer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_REQUEST);

  const parsed = requestTransferSchema.safeParse({
    productId: formData.get("productId"),
    destinationBranchId: formData.get("destinationBranchId"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transfer request." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const transfer = await transferService.requestTransfer(tx, membership.companyId, membership.membershipId, {
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        destinationBranchId: parsed.data.destinationBranchId,
        notes: parsed.data.notes,
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "transfer.requested",
        entityType: "StockTransfer",
        entityId: transfer.id,
        metadata: { productId: transfer.productId, quantity: transfer.quantity },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not create the transfer request.") };
  }

  revalidatePath("/branch-stock");
  return { error: "", success: true };
}

export async function approveTransfer(
  transferId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_APPROVE);

  const parsed = resolveTransferSchema.safeParse({
    sourceType: formData.get("sourceType"),
    sourceWarehouseId: formData.get("sourceWarehouseId"),
    sourceBranchId: formData.get("sourceBranchId"),
    externalSourceName: formData.get("externalSourceName"),
    batchNumber: formData.get("batchNumber"),
    expiryDate: formData.get("expiryDate"),
    manufactureDate: formData.get("manufactureDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Select a source for this transfer." };
  }

  const resolution =
    parsed.data.sourceType === "WAREHOUSE"
      ? ({ sourceType: "WAREHOUSE", sourceWarehouseId: parsed.data.sourceWarehouseId! } as const)
      : parsed.data.sourceType === "BRANCH"
        ? ({ sourceType: "BRANCH", sourceBranchId: parsed.data.sourceBranchId! } as const)
        : ({
            sourceType: "EXTERNAL",
            externalSourceName: parsed.data.externalSourceName!,
            batch:
              parsed.data.batchNumber && parsed.data.expiryDate
                ? { batchNumber: parsed.data.batchNumber, expiryDate: parsed.data.expiryDate, manufactureDate: parsed.data.manufactureDate }
                : undefined,
          } as const);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const transfer = await transferService.approveTransfer(tx, membership.companyId, membership.membershipId, transferId, resolution);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "transfer.approved",
        entityType: "StockTransfer",
        entityId: transfer.id,
        metadata: { sourceType: resolution.sourceType },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not approve the transfer.") };
  }

  revalidatePath("/branch-stock");
  return { error: "", success: true };
}

export async function rejectTransfer(
  transferId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_APPROVE);

  const parsed = rejectTransferSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A rejection reason is required." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const transfer = await transferService.rejectTransfer(tx, membership.membershipId, transferId, parsed.data.reason);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "transfer.rejected",
        entityType: "StockTransfer",
        entityId: transfer.id,
        metadata: { reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not reject the transfer.") };
  }

  revalidatePath("/branch-stock");
  return { error: "", success: true };
}

export async function cancelTransfer(transferId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  const db = getScopedPrisma(membership.companyId);

  const transfer = await db.stockTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return;

  const isRequester = transfer.requestedByMembershipId === membership.membershipId;
  if (!isRequester) {
    await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_APPROVE);
  }

  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const updated = await transferService.cancelTransfer(tx, membership.membershipId, transferId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "transfer.cancelled",
      entityType: "StockTransfer",
      entityId: updated.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/branch-stock");
}

export async function dispatchTransfer(transferId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_DISPATCH);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const transfer = await transferService.dispatchTransfer(tx, membership.companyId, membership.membershipId, transferId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "transfer.dispatched",
      entityType: "StockTransfer",
      entityId: transfer.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/branch-stock");
}

export async function receiveTransfer(
  transferId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_RECEIVE);

  const parsed = receiveTransferSchema.safeParse({
    receivedQuantity: formData.get("receivedQuantity"),
    notes: formData.get("notes"),
    batchNumber: formData.get("batchNumber"),
    expiryDate: formData.get("expiryDate"),
    manufactureDate: formData.get("manufactureDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid received quantity." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const manualBatch =
    parsed.data.batchNumber && parsed.data.expiryDate
      ? { batchNumber: parsed.data.batchNumber, expiryDate: parsed.data.expiryDate, manufactureDate: parsed.data.manufactureDate }
      : undefined;

  try {
    await db.$transaction(async (tx) => {
      const { transfer, hasDiscrepancy } = await transferService.receiveTransfer(
        tx,
        membership.companyId,
        membership.membershipId,
        transferId,
        parsed.data.receivedQuantity,
        parsed.data.notes,
        manualBatch,
      );

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "transfer.received",
        entityType: "StockTransfer",
        entityId: transfer.id,
        metadata: { receivedQuantity: parsed.data.receivedQuantity, requestedQuantity: transfer.quantity },
        ipAddress,
        userAgent,
      });

      if (hasDiscrepancy) {
        await writeAuditLog(tx, {
          companyId: membership.companyId,
          actorMembershipId: membership.membershipId,
          action: "transfer.discrepancy",
          entityType: "StockTransfer",
          entityId: transfer.id,
          metadata: { receivedQuantity: parsed.data.receivedQuantity, requestedQuantity: transfer.quantity },
          ipAddress,
          userAgent,
        });

        // Push, not pull — a discrepancy used to only reach the passive
        // audit log, so nobody was actually alerted unless they happened
        // to go look. Owner + Admin get notified the moment it happens.
        const [product, names, recipientIds] = await Promise.all([
          tx.product.findUnique({ where: { id: transfer.productId }, select: { name: true } }),
          resolveMembershipNames(tx, [membership.membershipId]),
          getOwnerAndAdminMembershipIds(tx),
        ]);
        if (recipientIds.length > 0) {
          await createNotifications(tx, membership.companyId, recipientIds, {
            type: "TRANSFER_DISCREPANCY",
            title: `Transfer discrepancy: ${product?.name ?? "a product"}`,
            body: `${names.get(membership.membershipId) ?? "A staff member"} received ${parsed.data.receivedQuantity} unit(s) of ${product?.name ?? "this product"}, but ${transfer.quantity} were requested.`,
            entityType: "StockTransfer",
            entityId: transfer.id,
          });
        }
      }
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not record the receipt.") };
  }

  revalidatePath("/branch-stock");
  return { error: "", success: true };
}

export async function receiveExternalStock(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL);

  const parsed = receiveExternalSchema.safeParse({
    productId: formData.get("productId"),
    destinationType: formData.get("destinationType"),
    destinationWarehouseId: formData.get("destinationWarehouseId"),
    destinationBranchId: formData.get("destinationBranchId"),
    quantity: formData.get("quantity"),
    externalSourceName: formData.get("externalSourceName"),
    notes: formData.get("notes"),
    batchNumber: formData.get("batchNumber"),
    expiryDate: formData.get("expiryDate"),
    manufactureDate: formData.get("manufactureDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid delivery details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const batch =
    parsed.data.batchNumber && parsed.data.expiryDate
      ? {
          batchNumber: parsed.data.batchNumber,
          expiryDate: parsed.data.expiryDate,
          manufactureDate: parsed.data.manufactureDate,
        }
      : undefined;

  const destination =
    parsed.data.destinationType === "WAREHOUSE"
      ? { destinationWarehouseId: parsed.data.destinationWarehouseId! }
      : { destinationBranchId: parsed.data.destinationBranchId! };

  try {
    await db.$transaction(async (tx) => {
      const transfer = await transferService.receiveExternalStock(tx, membership.companyId, membership.membershipId, {
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        externalSourceName: parsed.data.externalSourceName,
        notes: parsed.data.notes,
        batch,
        ...destination,
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "transfer.external_receipt",
        entityType: "StockTransfer",
        entityId: transfer.id,
        metadata: { productId: transfer.productId, quantity: transfer.quantity, source: parsed.data.externalSourceName },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not record the delivery.") };
  }

  revalidatePath("/branch-stock");
  revalidatePath("/warehouses");
  return { error: "", success: true };
}
