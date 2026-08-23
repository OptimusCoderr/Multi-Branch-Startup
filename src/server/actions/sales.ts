"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission, isOwnerOrAdminMembership } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createSaleSchema, recordPaymentSchema, voidSaleSchema } from "@/lib/validation/sale.schema";
import * as saleService from "@/server/services/sale-service";
import { InsufficientStockError } from "@/server/services/inventory-service";
import { SalesReportStateError } from "@/server/services/sales-report-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (
    err instanceof saleService.SaleValidationError ||
    err instanceof saleService.SaleNotFoundError ||
    err instanceof InsufficientStockError ||
    err instanceof SalesReportStateError ||
    err instanceof RateLimitError
  ) {
    return err.message;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    return "That conflicted with another change happening at the same time. Please try again.";
  }
  return fallback;
}

export async function createSale(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

  try {
    // Generous — this is a legitimate high-frequency POS action — but caps
    // runaway loops/abuse rather than normal checkout usage.
    checkRateLimit(`sale.create:${membership.membershipId}`, { max: 120, windowMs: 60 * 1000 });
  } catch (err) {
    return { error: friendlyError(err, "Too many sales recorded recently.") };
  }

  let lineItems: unknown;
  try {
    lineItems = JSON.parse(String(formData.get("lineItems") ?? "[]"));
  } catch {
    return { error: "Invalid line items." };
  }

  const parsed = createSaleSchema.safeParse({
    branchId: formData.get("branchId"),
    customerId: formData.get("customerId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail"),
    dueDate: formData.get("dueDate"),
    lineItems,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sale details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();
  let saleId = "";

  try {
    await db.$transaction(async (tx) => {
      const sale = await saleService.createSale(tx, membership.companyId, membership.membershipId, {
        ...parsed.data,
        isReportExempt: isOwnerOrAdminMembership(membership),
      });
      saleId = sale.id;

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "sale.created",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { saleNumber: sale.saleNumber, grandTotal: sale.grandTotal.toString() },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not record the sale.") };
  }

  revalidatePath("/sales");
  redirect(`/sales/${saleId}`);
}

export async function recordPayment(saleId: string, _prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.PAYMENTS_RECORD);

  try {
    checkRateLimit(`payment.record:${membership.membershipId}`, { max: 120, windowMs: 60 * 1000 });
  } catch (err) {
    return { error: friendlyError(err, "Too many payments recorded recently.") };
  }

  const parsed = recordPaymentSchema.safeParse({
    amount: formData.get("amount"),
    mode: formData.get("mode"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(
      async (tx) => {
        const { payment } = await saleService.recordPayment(tx, membership.companyId, membership.membershipId, {
          saleId,
          amount: new Prisma.Decimal(parsed.data.amount),
          mode: parsed.data.mode,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
        });

        await writeAuditLog(tx, {
          companyId: membership.companyId,
          actorMembershipId: membership.membershipId,
          action: "payment.recorded",
          entityType: "Payment",
          entityId: payment.id,
          metadata: { saleId, amount: payment.amount.toString(), mode: payment.mode },
          ipAddress,
          userAgent,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    return { error: friendlyError(err, "Could not record the payment.") };
  }

  revalidatePath(`/sales/${saleId}`);
  redirect(`/sales/${saleId}`);
}

export async function voidSale(saleId: string, _prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SALES_VOID);

  const parsed = voidSaleSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const sale = await saleService.voidSale(tx, membership.companyId, membership.membershipId, saleId, parsed.data.reason);
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "sale.voided",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not void the sale.") };
  }

  revalidatePath("/sales");
  redirect(`/sales/${saleId}`);
}
