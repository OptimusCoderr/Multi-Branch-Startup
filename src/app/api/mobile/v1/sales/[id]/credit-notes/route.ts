import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { issueCreditNoteSchema } from "@/lib/validation/credit-note.schema";
import * as creditNoteService from "@/server/services/credit-note-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit } from "@/lib/rate-limit";

/** Same issueCreditNote flow the web sale detail page uses, reusing the identical service and validation. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: saleId } = await params;
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.CREDIT_NOTES_ISSUE);

    try {
      checkRateLimit(`credit_note.issue:${membership.membershipId}`, { max: 60, windowMs: 60 * 1000 });
    } catch (err) {
      return handleApiError(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = issueCreditNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid credit note details.", 400);
    }

    const db = getScopedPrisma(membership.companyId);
    let creditNoteId = "";

    await db.$transaction(async (tx) => {
      const creditNote = await creditNoteService.issueCreditNote(tx, membership.companyId, membership.membershipId, {
        saleId,
        amount: new Prisma.Decimal(parsed.data.amount),
        reason: parsed.data.reason,
      });
      creditNoteId = creditNote.id;

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "credit_note.issued",
        entityType: "CreditNote",
        entityId: creditNote.id,
        metadata: { saleId, amount: creditNote.amount.toString(), reason: parsed.data.reason, source: "mobile" },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ creditNoteId }, { status: 201 });
  } catch (err) {
    return handleApiError(err, [creditNoteService.CreditNoteValidationError, creditNoteService.CreditNoteNotFoundError]);
  }
}
