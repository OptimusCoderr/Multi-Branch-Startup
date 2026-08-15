"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createCompanySchema, slugify } from "@/lib/validation/onboarding.schema";
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLE_NAMES } from "@/lib/auth/permissions";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenses/default-categories";

type ActionResult = { error: string } | never;

/**
 * Runs once, immediately after a brand-new user completes Better Auth
 * sign-up on the client. Creates their Company, seeds the five system
 * Roles with their default permissions, makes the signing-up user the
 * Owner, and starts a trial Subscription. This is the one place in the
 * codebase allowed to use the raw (unscoped) `prisma` client for writes,
 * because the Company doesn't exist yet — there is no companyId to scope
 * to until this transaction commits.
 */
export async function createCompanyForCurrentUser(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to create a company." };
  }

  const parsed = createCompanySchema.safeParse({
    companyName: formData.get("companyName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid company name." };
  }

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "INVITED"] } },
  });
  if (existingMembership) {
    return { error: "This account is already linked to a company." };
  }

  const baseSlug = slugify(parsed.data.companyName) || "company";
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.company.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const starterPlan = await prisma.plan.findUnique({ where: { name: "Starter" } });
  if (!starterPlan) {
    return { error: "Onboarding is temporarily unavailable. Please try again shortly." };
  }

  const permissions = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for");
  const userAgent = requestHeaders.get("user-agent");

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: parsed.data.companyName,
        slug,
        status: "TRIAL",
      },
    });

    const roleByName = new Map<string, string>();
    for (const roleName of SYSTEM_ROLE_NAMES) {
      const role = await tx.role.create({
        data: { companyId: company.id, name: roleName, isSystem: true },
      });
      roleByName.set(roleName, role.id);

      const grantedKeys = DEFAULT_ROLE_PERMISSIONS[roleName] ?? [];
      const rolePermissionRows = grantedKeys
        .map((key) => permissionIdByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));

      if (rolePermissionRows.length > 0) {
        await tx.rolePermission.createMany({ data: rolePermissionRows });
      }
    }

    const ownerRoleId = roleByName.get("Owner");
    const now = new Date();
    const membership = await tx.membership.create({
      data: {
        companyId: company.id,
        userId: session.user.id,
        roleId: ownerRoleId,
        status: "ACTIVE",
        joinedAt: now,
      },
    });

    await tx.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ companyId: company.id, name })),
    });

    await tx.subscription.create({
      data: {
        companyId: company.id,
        planId: starterPlan.id,
        status: "TRIALING",
        trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorMembershipId: membership.id,
        actorType: "USER",
        action: "company.created",
        entityType: "Company",
        entityId: company.id,
        metadata: { name: company.name, slug: company.slug },
        ipAddress,
        userAgent,
      },
    });

  });

  redirect("/dashboard");
}
