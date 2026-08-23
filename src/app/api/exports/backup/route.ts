import { headers } from "next/headers";
import { requireMembershipOrThrow, isOwnerMembership, AuthorizationError } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { buildCompanyBackup } from "@/server/services/backup-service";
import { writeAuditLog } from "@/server/services/audit-service";
import { createNotifications, getOwnerAndAdminMembershipIds } from "@/server/services/notification-service";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

/**
 * Owner-only, matching Reset Data's gating — this exports every sale,
 * customer, and product record a company has, so it's kept as narrow as
 * the other most-sensitive actions in the app rather than opened up to
 * Admin. Mirrors ALLMAAJ's own rationale for pairing a sensitive download
 * with a peer notification instead of only a passive audit-log row — "the
 * exact kind of action that let a DB dump end up committed to git
 * unnoticed" if nobody else even knows it happened.
 */
export async function GET() {
  try {
    const membership = await requireMembershipOrThrow();
    if (!isOwnerMembership(membership)) {
      throw new AuthorizationError("Only the Owner can download a full data backup.");
    }

    const db = getScopedPrisma(membership.companyId);
    const backup = await buildCompanyBackup(db, membership.companyId);
    const h = await headers();

    await db.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "company.backup_downloaded",
        entityType: "Company",
        entityId: membership.companyId,
        ipAddress: h.get("x-forwarded-for"),
        userAgent: h.get("user-agent"),
      });

      const recipientIds = (await getOwnerAndAdminMembershipIds(tx)).filter((id) => id !== membership.membershipId);
      if (recipientIds.length > 0) {
        const names = await resolveMembershipNames(tx, [membership.membershipId]);
        await createNotifications(tx, membership.companyId, recipientIds, {
          type: "BACKUP_DOWNLOADED",
          title: "Full data backup downloaded",
          body: `${names.get(membership.membershipId) ?? "The Owner"} downloaded a full backup of your company's data.`,
        });
      }
    });

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup-${membership.companySlug}-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return new Response(err.message, { status: 403 });
    }
    throw err;
  }
}
