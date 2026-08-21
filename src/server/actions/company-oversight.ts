"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdminOrThrow } from "@/lib/auth/session";
import { writePlatformAuditLog } from "@/server/services/platform-audit-service";

type ActionResult = { error: string };

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

/**
 * All mutations here are SUPER_ADMIN only — a SUPPORT_AGENT's access to
 * company data stays strictly read-only (see /admin/companies/[id]'s own
 * doc comment). Approving/rejecting a business's verification, or
 * suspending its account, is a trust decision on par with granting
 * platform access, not day-to-day support work.
 */

export async function approveCompanyVerification(companyId: string): Promise<ActionResult | void> {
  const admin = await requireSuperAdminOrThrow();

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found." };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      verificationStatus: "VERIFIED",
      verificationReviewedAt: new Date(),
      verificationReviewedByUserId: admin.userId,
      verificationNote: null,
    },
  });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.company_verified",
    metadata: { companyId, companyName: company.name },
    ipAddress,
    userAgent,
  });

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin");
}

const reasonSchema = z.object({ reason: z.string().trim().min(1, "A reason is required").max(500) });

export async function rejectCompanyVerification(
  companyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdminOrThrow();

  const parsed = reasonSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found." };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      verificationStatus: "REJECTED",
      verificationReviewedAt: new Date(),
      verificationReviewedByUserId: admin.userId,
      verificationNote: parsed.data.reason,
    },
  });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.company_verification_rejected",
    metadata: { companyId, companyName: company.name, reason: parsed.data.reason },
    ipAddress,
    userAgent,
  });

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin");
  return { error: "" };
}

/** For a company with no CAC (or one still pending incorporation) that a platform admin has vetted enough to let operate anyway. */
export async function approveCompanyWithoutCac(
  companyId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdminOrThrow();
  const note = (formData.get("note") as string | null)?.trim() || null;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found." };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      verificationStatus: "APPROVED_WITHOUT_CAC",
      verificationReviewedAt: new Date(),
      verificationReviewedByUserId: admin.userId,
      verificationNote: note,
    },
  });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.company_approved_without_cac",
    metadata: { companyId, companyName: company.name, note },
    ipAddress,
    userAgent,
  });

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin");
  return { error: "" };
}

/**
 * The security kill switch — sets Company.status to SUSPENDED, which
 * getCurrentMembership() (src/lib/auth/session.ts) already treats as
 * "no active membership," locking every staff member out of the whole
 * authenticated app immediately. Independent of billing/subscription
 * status entirely.
 */
export async function disableCompany(companyId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdminOrThrow();

  const parsed = reasonSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found." };
  if (company.status === "SUSPENDED") return { error: "This company is already disabled." };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      status: "SUSPENDED",
      statusBeforeSuspension: company.status,
      disabledAt: new Date(),
      disabledByUserId: admin.userId,
      disabledReason: parsed.data.reason,
    },
  });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.company_disabled",
    metadata: { companyId, companyName: company.name, reason: parsed.data.reason },
    ipAddress,
    userAgent,
  });

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin");
  return { error: "" };
}

export async function enableCompany(companyId: string): Promise<ActionResult | void> {
  const admin = await requireSuperAdminOrThrow();

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found." };
  if (company.status !== "SUSPENDED") return { error: "This company is not disabled." };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      status: company.statusBeforeSuspension ?? "ACTIVE",
      statusBeforeSuspension: null,
      disabledAt: null,
      disabledByUserId: null,
      disabledReason: null,
    },
  });

  const { ipAddress, userAgent } = await requestMeta();
  await writePlatformAuditLog({
    actorUserId: admin.userId,
    action: "platform.company_enabled",
    metadata: { companyId, companyName: company.name },
    ipAddress,
    userAgent,
  });

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin");
}
