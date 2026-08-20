import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { voidCreditNoteSchema } from "@/lib/validation/credit-note.schema";
import * as creditNoteService from "@/server/services/credit-note-service";
import { writeAuditLog } from "@/server/services/audit-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: creditNoteId } = await params;
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.CREDIT_NOTES_VOID);

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = voidCreditNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "A reason is required.", 400);
    }

    const db = getScopedPrisma(membership.companyId);

    await db.$transaction(async (tx) => {
      const creditNote = await creditNoteService.voidCreditNote(tx, membership.membershipId, creditNoteId, parsed.data.reason);

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "credit_note.voided",
        entityType: "CreditNote",
        entityId: creditNote.id,
        metadata: { reason: parsed.data.reason, source: "mobile" },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, [creditNoteService.CreditNoteValidationError, creditNoteService.CreditNoteNotFoundError]);
  }
}
