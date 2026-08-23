"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, isOwnerOrAdminMembership, AuthorizationError } from "@/lib/auth/session";
import { resolveLockedWaybillSchema } from "@/lib/validation/waybill.schema";
import { resolveLockedWaybill as resolveLockedWaybillService, WaybillResolutionError } from "@/server/services/transfer-service";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string; success?: boolean };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

/**
 * The only way past a LOCKED waybill — Owner/Admin only, matching the
 * sensitivity of every other "manually override a safety check" action in
 * this app. See resolveLockedWaybill() in transfer-service.ts for what
 * each resolution actually does to stock.
 */
export async function resolveLockedWaybillAction(waybillId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  if (!isOwnerOrAdminMembership(membership)) {
    throw new AuthorizationError("Only an Owner or Admin can resolve a locked waybill.");
  }

  const parsed = resolveLockedWaybillSchema.safeParse({ resolution: formData.get("resolution") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid resolution." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const result = await resolveLockedWaybillService(tx, membership.companyId, membership.membershipId, waybillId, parsed.data.resolution);

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: parsed.data.resolution === "ACCEPT_LAST_COUNT" ? "waybill.resolved_accepted" : "waybill.resolved_rejected",
        entityType: "StockTransfer",
        entityId: result.transfer.id,
        metadata: { waybillId, resolution: parsed.data.resolution },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: err instanceof WaybillResolutionError ? err.message : "Could not resolve this waybill." };
  }

  revalidatePath("/branch-stock");
  return { error: "", success: true };
}
