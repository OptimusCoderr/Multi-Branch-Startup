"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { issueCreditNoteSchema, voidCreditNoteSchema } from "@/lib/validation/credit-note.schema";
import * as creditNoteService from "@/server/services/credit-note-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

function friendlyError(err: unknown, fallback: string): string {
  if (
    err instanceof creditNoteService.CreditNoteValidationError ||
    err instanceof creditNoteService.CreditNoteNotFoundError ||
    err instanceof RateLimitError
  ) {
    return err.message;
  }
  return fallback;
}

export async function issueCreditNote(saleId: string, _prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.CREDIT_NOTES_ISSUE);

  try {
    checkRateLimit(`credit_note.issue:${membership.membershipId}`, { max: 60, windowMs: 60 * 1000 });
  } catch (err) {
    return { error: friendlyError(err, "Too many credit notes issued recently.") };
  }

  const parsed = issueCreditNoteSchema.safeParse({
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credit note details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const creditNote = await creditNoteService.issueCreditNote(tx, membership.companyId, membership.membershipId, {
        saleId,
        amount: new Prisma.Decimal(parsed.data.amount),
        reason: parsed.data.reason,
      });

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "credit_note.issued",
        entityType: "CreditNote",
        entityId: creditNote.id,
        metadata: { saleId, amount: creditNote.amount.toString(), reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not issue the credit note.") };
  }

  revalidatePath(`/sales/${saleId}`);
  redirect(`/sales/${saleId}`);
}

export async function voidCreditNote(
  saleId: string,
  creditNoteId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.CREDIT_NOTES_VOID);

  const parsed = voidCreditNoteSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await db.$transaction(async (tx) => {
      const creditNote = await creditNoteService.voidCreditNote(tx, membership.membershipId, creditNoteId, parsed.data.reason);

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "credit_note.voided",
        entityType: "CreditNote",
        entityId: creditNote.id,
        metadata: { reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
    });
  } catch (err) {
    return { error: friendlyError(err, "Could not void the credit note.") };
  }

  revalidatePath(`/sales/${saleId}`);
  redirect(`/sales/${saleId}`);
}
