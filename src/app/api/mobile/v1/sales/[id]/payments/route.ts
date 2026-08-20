import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordPaymentSchema } from "@/lib/validation/sale.schema";
import * as saleService from "@/server/services/sale-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit } from "@/lib/rate-limit";

/** Same recordPayment flow the web sale detail page uses — SERIALIZABLE isolation and all. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: saleId } = await params;
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.PAYMENTS_RECORD);

    try {
      checkRateLimit(`payment.record:${membership.membershipId}`, { max: 120, windowMs: 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid payment details.", 400);
    }

    const db = getScopedPrisma(membership.companyId);

    const { payment } = await db.$transaction(
      async (tx) => {
        const result = await saleService.recordPayment(tx, membership.companyId, membership.membershipId, {
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
          entityId: result.payment.id,
          metadata: { saleId, amount: result.payment.amount.toString(), mode: result.payment.mode, source: "mobile" },
        });

        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ paymentId: payment.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, [saleService.SaleValidationError, saleService.SaleNotFoundError]);
  }
}
