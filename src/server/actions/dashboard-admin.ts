"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMembershipOrThrow, isOwnerMembership, AuthorizationError } from "@/lib/auth/session";
import { resetSalesDaySchema } from "@/lib/validation/dashboard-admin.schema";
import { resetSalesForDay, ResetDateInFutureError } from "@/server/services/sale-reset-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { createNotifications, getOwnerAndAdminMembershipIds } from "@/server/services/notification-service";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

type ResetResult = { error: string; voidedCount?: number; skippedPaidCount?: number };

/**
 * Owner-only, typed "RESET" confirmation. Voids every *unpaid* sale on the
 * chosen day — see sale-reset-service.ts for why a paid sale is
 * deliberately left untouched rather than force-voided.
 */
export async function resetSalesDay(_prev: ResetResult, formData: FormData): Promise<ResetResult> {
  const membership = await requireMembershipOrThrow();
  if (!isOwnerMembership(membership)) {
    throw new AuthorizationError("Only the Owner can reset a day's sales data.");
  }

  const parsed = resetSalesDaySchema.safeParse({
    date: formData.get("date"),
    confirmText: formData.get("confirmText"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getScopedPrisma(membership.companyId);
  const { ipAddress, userAgent } = await requestMeta();

  try {
    const result = await db.$transaction(async (tx) => {
      const company = await tx.company.findUniqueOrThrow({ where: { id: membership.companyId }, select: { timezone: true } });
      const outcome = await resetSalesForDay(tx, membership.companyId, membership.membershipId, company.timezone, parsed.data.date);

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "company.sales_reset",
        entityType: "Company",
        entityId: membership.companyId,
        metadata: { date: parsed.data.date, ...outcome },
        ipAddress,
        userAgent,
      });

      const recipientIds = (await getOwnerAndAdminMembershipIds(tx)).filter((id) => id !== membership.membershipId);
      if (recipientIds.length > 0) {
        const names = await resolveMembershipNames(tx, [membership.membershipId]);
        await createNotifications(tx, membership.companyId, recipientIds, {
          type: "SALES_RESET",
          title: `Sales data reset for ${parsed.data.date}`,
          body: `${names.get(membership.membershipId) ?? "The Owner"} voided ${outcome.voidedCount} unpaid sale(s) for ${parsed.data.date}${
            outcome.skippedPaidCount > 0 ? ` (${outcome.skippedPaidCount} already-paid sale(s) were left untouched)` : ""
          }.`,
        });
      }

      return outcome;
    });

    revalidatePath("/dashboard");
    revalidatePath("/sales");
    return { error: "", voidedCount: result.voidedCount, skippedPaidCount: result.skippedPaidCount };
  } catch (err) {
    if (err instanceof ResetDateInFutureError) {
      return { error: err.message };
    }
    return { error: "Could not reset that day's sales." };
  }
}

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for"), userAgent: h.get("user-agent") };
}
