import "server-only";
import type { Prisma } from "@prisma/client";

// Deliberately a minimal structural type (not derived from getScopedPrisma's
// extended client type) so this accepts both a tenant-scoped transaction
// client and the raw prisma client's transaction — the latter is used by
// the handful of actions (onboarding, invitation acceptance) that run
// before a companyId scope exists yet.
type AuditLogWriter = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
};

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
export async function writeAuditLog(tx: AuditLogWriter, input: WriteAuditLogInput) {
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
