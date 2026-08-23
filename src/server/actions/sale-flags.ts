"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { flagSaleSchema, resolveSaleFlagSchema } from "@/lib/validation/sale-flag.schema";
import * as saleFlagService from "@/server/services/sale-flag-service";
import { createNotification } from "@/server/services/notification-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof saleFlagService.SaleFlagStateError || err instanceof saleFlagService.SaleFlagNotFoundError) {
    return err.message;
  }
  return fallback;
}

export async function flagSale(saleId: string, _prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SALES_FLAG);

  const parsed = flagSaleSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const { flag, sale } = await saleFlagService.flagSale(tx, membership.companyId, membership.membershipId, saleId, parsed.data.reason);

      const names = await resolveMembershipNames(tx, [membership.membershipId]);
      await createNotification(tx, membership.companyId, {
        membershipId: sale.soldByMembershipId,
        type: "SALE_FLAGGED",
        title: `Sale ${sale.saleNumber} was flagged`,
        body: `${names.get(membership.membershipId) ?? "A reviewer"} flagged this sale: "${parsed.data.reason}". Correct and resubmit it before midnight today.`,
        entityType: "Sale",
        entityId: sale.id,
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "sale.flagged",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { flagId: flag.id, reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not flag this sale.") };
  }

  revalidatePath(`/sales/${saleId}`);
  redirect(`/sales/${saleId}`);
}

export async function resolveSaleFlag(
  flagId: string,
  saleId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

  const parsed = resolveSaleFlagSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail"),
    dueDate: formData.get("dueDate"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid correction details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const { flag, sale } = await saleFlagService.resolveSaleFlag(tx, membership.membershipId, flagId, parsed.data);

      const names = await resolveMembershipNames(tx, [membership.membershipId]);
      await createNotification(tx, membership.companyId, {
        membershipId: flag.flaggedByMembershipId,
        type: "SALE_FLAG_RESOLVED",
        title: `Sale ${sale.saleNumber} was corrected`,
        body: `${names.get(membership.membershipId) ?? "Someone"} corrected and resubmitted the sale you flagged: "${parsed.data.note}"`,
        entityType: "Sale",
        entityId: sale.id,
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "sale.flag_resolved",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { flagId: flag.id, note: parsed.data.note },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not resubmit this sale.") };
  }

  revalidatePath(`/sales/${saleId}`);
  redirect(`/sales/${saleId}`);
}
