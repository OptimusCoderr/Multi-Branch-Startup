"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { submitCacVerificationSchema } from "@/lib/validation/verification.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

/**
 * Submits (or resubmits) a CAC certificate link for platform-admin review.
 * A no-CAC company can still operate — this is purely opt-in — but
 * submitting always moves the company to PENDING_REVIEW, even if it was
 * previously REJECTED or sitting UNVERIFIED past its deadline.
 */
export async function submitCacVerification(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const parsed = submitCacVerificationSchema.safeParse({
    rcNumber: formData.get("rcNumber"),
    incorporationDate: formData.get("incorporationDate"),
    cacCertificateUrl: formData.get("cacCertificateUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  await db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: membership.companyId },
      data: {
        rcNumber: parsed.data.rcNumber,
        incorporationDate: parsed.data.incorporationDate,
        cacCertificateUrl: parsed.data.cacCertificateUrl,
        cacSubmittedAt: new Date(),
        verificationStatus: "PENDING_REVIEW",
        verificationNote: null,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "company.cac_submitted",
      entityType: "Company",
      entityId: membership.companyId,
      metadata: { cacCertificateUrl: parsed.data.cacCertificateUrl },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/settings/verification");
  revalidatePath("/dashboard");
  return { error: "" };
}
