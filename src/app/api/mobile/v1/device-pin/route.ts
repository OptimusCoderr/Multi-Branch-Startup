import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { hashDevicePin } from "@/lib/auth/device-pin";
import { setDevicePinSchema } from "@/lib/validation/device-pin.schema";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Self-service only — a staff member sets/changes their OWN quick-switch
 * PIN, never an Owner setting it for someone else. Requires being
 * genuinely signed in right now; the PIN itself only ever gates
 * reactivating that same real session later on a shared device (see
 * mobile/lib/device-profiles.ts), it never authenticates on its own.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireMobileMembership();

    try {
      checkRateLimit(`device_pin.set:${membership.membershipId}`, { max: 10, windowMs: 60 * 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = setDevicePinSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid PIN.", 400);
    }

    const db = getScopedPrisma(membership.companyId);
    const devicePinHash = hashDevicePin(parsed.data.pin);

    await db.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: membership.membershipId }, data: { devicePinHash } });
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "membership.device_pin_set",
        entityType: "Membership",
        entityId: membership.membershipId,
        metadata: { source: "mobile" },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
