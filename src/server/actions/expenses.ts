"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { expenseCategorySchema, createExpenseSchema, voidExpenseSchema } from "@/lib/validation/expense.schema";
import { writeAuditLog } from "@/server/services/audit-service";

type ActionResult = { error: string } | never;

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}

export async function createExpenseCategory(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.EXPENSES_MANAGE);

  const parsed = expenseCategorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category name." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.expenseCategory.findFirst({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: `A category named "${parsed.data.name}" already exists.` };
  }

  await db.$transaction(async (tx) => {
    const category = await tx.expenseCategory.create({
      data: { companyId: membership.companyId, name: parsed.data.name },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "expense_category.created",
      entityType: "ExpenseCategory",
      entityId: category.id,
      metadata: { name: category.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function archiveExpenseCategory(categoryId: string): Promise<void> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.EXPENSES_MANAGE);

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.expenseCategory.update({
      where: { id: categoryId },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: existing.isActive ? "expense_category.archived" : "expense_category.reactivated",
      entityType: "ExpenseCategory",
      entityId: categoryId,
      metadata: { name: existing.name },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/expenses");
}

export async function createExpense(_prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.EXPENSES_MANAGE);

  const parsed = createExpenseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    branchId: formData.get("branchId"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    description: formData.get("description"),
    isRecurring: formData.get("isRecurring"),
    recurrenceInterval: formData.get("recurrenceInterval"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid expense details." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const category = await db.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || !category.isActive) {
    return { error: "Selected category is unavailable." };
  }

  await db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        companyId: membership.companyId,
        categoryId: parsed.data.categoryId,
        branchId: parsed.data.branchId ?? null,
        amount: parsed.data.amount,
        expenseDate: parsed.data.expenseDate ?? new Date(),
        description: parsed.data.description ?? null,
        isRecurring: parsed.data.isRecurring,
        recurrenceInterval: parsed.data.isRecurring ? parsed.data.recurrenceInterval : null,
        recordedByMembershipId: membership.membershipId,
      },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "expense.recorded",
      entityType: "Expense",
      entityId: expense.id,
      metadata: { amount: expense.amount.toString(), categoryId: expense.categoryId },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function voidExpense(expenseId: string, _prev: { error: string }, formData: FormData): Promise<ActionResult> {
  const membership = await requireMembershipOrThrow();
  await requirePermission(membership.membershipId, PERMISSIONS.EXPENSES_MANAGE);

  const parsed = voidExpenseSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  const existing = await db.expense.findUnique({ where: { id: expenseId } });
  if (!existing) {
    return { error: "Expense not found." };
  }
  if (existing.voidedAt) {
    return { error: "This expense is already voided." };
  }

  await db.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: { voidedByMembershipId: membership.membershipId, voidedAt: new Date(), voidReason: parsed.data.reason },
    });

    await writeAuditLog(tx, {
      companyId: membership.companyId,
      actorMembershipId: membership.membershipId,
      action: "expense.voided",
      entityType: "Expense",
      entityId: expenseId,
      metadata: { reason: parsed.data.reason },
      ipAddress,
      userAgent,
    });
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}
