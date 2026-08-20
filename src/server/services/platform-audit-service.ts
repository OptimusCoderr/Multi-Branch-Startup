import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

type WritePlatformAuditLogInput = {
  actorUserId: string;
  action: string;
  targetEmail?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Platform-level counterpart to writeAuditLog() — for SUPER_ADMIN/SUPPORT_AGENT actions that don't belong to any one company. */
export async function writePlatformAuditLog(input: WritePlatformAuditLogInput) {
  await prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetEmail: input.targetEmail ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
