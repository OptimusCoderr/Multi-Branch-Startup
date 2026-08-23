"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { joinCompanySchema } from "@/lib/validation/staff-signup.schema";
import { normalizeCompanyCode } from "@/lib/company-code";

type ActionResult = { error: string } | never;

/**
 * Runs after a brand-new user completes Better Auth sign-up on the client,
 * on the staff self-signup path (see sign-up/page.tsx). Unlike
 * createCompanyForCurrentUser (which creates the Company right away), this
 * only creates a PENDING Membership with no role — per the user's chosen
 * design, a company code is somewhat public (it can appear on invoices/
 * letterhead), so typing it alone must never grant real access. An Owner
 * has to review the request and assign a role (see staff.ts's
 * approvePendingStaff/rejectPendingStaff, task #91) before this user can
 * sign in to anything.
 */
export async function requestToJoinCompany(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to request to join a company." };
  }

  const parsed = joinCompanySchema.safeParse({ companyCode: formData.get("companyCode") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid company code." };
  }

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "INVITED", "PENDING"] } },
  });
  if (existingMembership) {
    return { error: "This account already has a pending or active company membership." };
  }

  const company = await prisma.company.findUnique({
    where: { companyCode: normalizeCompanyCode(parsed.data.companyCode) },
    select: { id: true },
  });
  if (!company) {
    return { error: "No company found with that code. Double-check with your employer." };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for");
  const userAgent = requestHeaders.get("user-agent");

  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        companyId: company.id,
        userId: session.user.id,
        status: "PENDING",
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorMembershipId: membership.id,
        actorType: "USER",
        action: "staff.requested_to_join",
        entityType: "Membership",
        entityId: membership.id,
        ipAddress,
        userAgent,
      },
    });
  });

  redirect("/pending-approval");
}
