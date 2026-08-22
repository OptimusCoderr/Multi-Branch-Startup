import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { verifyDevicePin } from "@/lib/auth/device-pin";
import { verifyDevicePinSchema } from "@/lib/validation/device-pin.schema";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Deliberately NOT behind requireMobileMembership() — this checks whether
 * a PIN matches a *different* membership than whoever's currently
 * signed in (that's the whole point of switching profiles on a shared
 * device), so there's no single "current company" to scope it to. Not a
 * new attack surface: it only ever gates reactivating a session that a
 * real email/password login already established and that the device
 * already holds locally — a correct PIN here never issues a new session
 * or reveals anything beyond true/false. Heavily rate-limited per
 * membershipId since a 4-6 digit PIN has a small keyspace.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = verifyDevicePinSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
    }

    try {
      checkRateLimit(`device_pin.verify:${parsed.data.membershipId}`, { max: 5, windowMs: 15 * 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const membership = await prisma.membership.findUnique({
      where: { id: parsed.data.membershipId },
      select: { devicePinHash: true, status: true },
    });

    const verified =
      Boolean(membership) && membership!.status === "ACTIVE" && Boolean(membership!.devicePinHash) && verifyDevicePin(parsed.data.pin, membership!.devicePinHash!);

    return NextResponse.json({ verified });
  } catch (err) {
    return handleApiError(err);
  }
}
