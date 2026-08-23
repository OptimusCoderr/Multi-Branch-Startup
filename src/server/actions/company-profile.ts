"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { companyProfileSchema } from "@/lib/validation/company-profile.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string };

/**
 * Corrects the company's display name — e.g. a typo made at sign-up.
 * Deliberately only touches Company.name: `slug` (used in URLs) and
 * `companyCode` (the fixed staff-join code, see company-code.ts) are both
 * meant to stay unchanged forever once set, so a rename never breaks a
 * bookmarked link or invalidates a code already handed out to staff.
 */
export async function updateCompanyName(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_COMPANY);

  const parsed = companyProfileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid company name." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for");
  const userAgent = h.get("user-agent");

  await db.$transaction(async (tx) => {
    const before = await tx.company.findUniqueOrThrow({ where: { id: membership.companyId }, select: { name: true } });

    await tx.company.update({
      where: { id: membership.companyId },
      data: { name: parsed.data.name },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "company.name_updated",
      entityType: "Company",
      entityId: membership.companyId,
      metadata: { before: before.name, after: parsed.data.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/settings/verification");
  revalidatePath("/dashboard");
  return { error: "" };
}
