import "server-only";
import type { Prisma } from "@prisma/client";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";

type WriteAuditLogInput = {
  companyId: string;
  actorMembershipId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Writes an immutable audit log entry. Called from inside the same DB
 * transaction as the mutation it's recording wherever possible, so the
 * audit trail can never drift from what actually happened.
 */
export async function writeAuditLog(
  tx: Pick<ReturnType<typeof getScopedPrisma>, "auditLog">,
  input: WriteAuditLogInput,
) {
  await tx.auditLog.create({
    data: {
      companyId: input.companyId,
      actorMembershipId: input.actorMembershipId,
      actorType: input.actorMembershipId ? "USER" : "SYSTEM",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
