"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  requestTransferSchema,
  rejectTransferSchema,
  receiveTransferSchema,
  receiveExternalSchema,
} from "@/lib/validation/transfer.schema";
import * as transferService from "@/server/services/transfer-service";
import { InsufficientStockError } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (
    err instanceof transferService.TransferStateError ||
    err instanceof transferService.TransferNotFoundError ||
    err instanceof InsufficientStockError
  ) {
    return err.message;
  }
  return fallback;
}

export async function requestTransfer(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_REQUEST);

  const parsed = requestTransferSchema.safeParse({
    productId: formData.get("productId"),
    sourceWarehouseId: formData.get("sourceWarehouseId"),
    destinationBranchId: formData.get("destinationBranchId"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transfer request." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();
  let transferId = "";

  try {
    await db.$transaction(async (tx) => {
      const transfer = await transferService.requestTransfer(tx, membership.companyId, membership.membershipId, parsed.data);
      transferId = transfer.id;

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

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
}

export async function approveTransfer(transferId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_APPROVE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    const transfer = await transferService.approveTransfer(tx, membership.membershipId, transferId);
    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "transfer.approved",
      entityType: "StockTransfer",
      entityId: transfer.id,
      metadata: {},
      ipAddress,
      userAgent,
    });
  });

  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/transfers");
}

export async function rejectTransfer(
  transferId: string,
  _prev: { error: string },
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

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
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

  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/transfers");
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

  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/transfers");
}

export async function receiveTransfer(
  transferId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_RECEIVE);

  const parsed = receiveTransferSchema.safeParse({
    receivedQuantity: formData.get("receivedQuantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid received quantity." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const { transfer, hasDiscrepancy } = await transferService.receiveTransfer(
        tx,
        membership.companyId,
        membership.membershipId,
        transferId,
        parsed.data.receivedQuantity,
        parsed.data.notes,
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
      }
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not record the receipt.") };
  }

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
}

export async function receiveExternalStock(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL);

  const parsed = receiveExternalSchema.safeParse({
    productId: formData.get("productId"),
    destinationBranchId: formData.get("destinationBranchId"),
    quantity: formData.get("quantity"),
    externalSourceName: formData.get("externalSourceName"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid delivery details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();
  let transferId = "";

  await db.$transaction(async (tx) => {
    const transfer = await transferService.receiveExternalStock(tx, membership.companyId, membership.membershipId, parsed.data);
    transferId = transfer.id;

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

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
}
