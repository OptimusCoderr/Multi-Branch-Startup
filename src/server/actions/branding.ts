"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { brandingSchema } from "@/lib/validation/branding.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string };

export async function updateBranding(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.SETTINGS_BRANDING);

  const parsed = brandingSchema.safeParse({
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    logoUrl: formData.get("logoUrl"),
    layoutPreset: formData.get("layoutPreset"),
    defaultTheme: formData.get("defaultTheme"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid branding settings." };
  }

  const db = getScopedPrisma(membership.companyId);
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for");
  const userAgent = h.get("user-agent");

  await db.$transaction(async (tx) => {
    await tx.brandingSettings.upsert({
      where: { companyId: membership.companyId },
      create: {
        companyId: membership.companyId,
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
        layoutPreset: parsed.data.layoutPreset,
        defaultTheme: parsed.data.defaultTheme,
      },
      update: {
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
        layoutPreset: parsed.data.layoutPreset,
        defaultTheme: parsed.data.defaultTheme,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "branding.updated",
      entityType: "BrandingSettings",
      entityId: membership.companyId,
      metadata: parsed.data,
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/settings/branding");
  revalidatePath("/", "layout");
  return { error: "" };
}
