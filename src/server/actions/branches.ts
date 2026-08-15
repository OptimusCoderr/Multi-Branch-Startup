"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { branchSchema } from "@/lib/validation/location.schema";
import { provisionStockForNewBranch } from "@/server/services/inventory-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { assertUnderBranchLimit, PlanLimitError } from "@/server/services/plan-limit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createBranch(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.BRANCHES_MANAGE);

  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid branch details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await assertUnderBranchLimit(db, membership.companyId);
  } catch (err) {
    return { error: err instanceof PlanLimitError ? err.message : "Could not verify your plan's branch limit." };
  }

  const existing = await db.branch.findFirst({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: `A branch named "${parsed.data.name}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const branch = await tx.branch.create({
      data: {
        companyId: membership.companyId,
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
      },
    });

    await provisionStockForNewBranch(tx, membership.companyId, branch.id);

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "branch.created",
      entityType: "Branch",
      entityId: branch.id,
      metadata: { name: branch.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/branches");
  redirect("/branches");
}

export async function updateBranch(
  branchId: string,
  _prev: { error: string },
  formData: FormData,
): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.BRANCHES_MANAGE);

  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid branch details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.branch.findUnique({ where: { id: branchId } });
  if (!existing) {
    return { error: "Branch not found." };
  }

  const nameTaken = await db.branch.findFirst({
    where: { name: parsed.data.name, id: { not: branchId } },
  });
  if (nameTaken) {
    return { error: `A branch named "${parsed.data.name}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.branch.update({
      where: { id: branchId },
      data: { name: parsed.data.name, address: parsed.data.address ?? null, phone: parsed.data.phone ?? null },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "branch.updated",
      entityType: "Branch",
      entityId: updated.id,
      metadata: { before: { name: existing.name }, after: { name: updated.name } },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/branches");
  redirect("/branches");
}

export async function deactivateBranch(branchId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.BRANCHES_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.branch.findUnique({ where: { id: branchId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.branch.update({
      where: { id: branchId },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: existing.isActive ? "branch.deactivated" : "branch.reactivated",
      entityType: "Branch",
      entityId: branchId,
      metadata: { name: existing.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/branches");
}
