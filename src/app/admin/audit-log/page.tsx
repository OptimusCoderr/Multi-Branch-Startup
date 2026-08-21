import { requirePlatformStaffWithTwoFactor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  AdminPageHeader,
  AdminTable,
  AdminTableHeader,
  AdminTableHeaderCell,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
  AdminEmptyState,
} from "@/components/ui-admin";

export default async function AdminAuditLogPage() {
  await requirePlatformStaffWithTwoFactor();

  const entries = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actorIds = [...new Set(entries.map((e) => e.actorUserId))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } });
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Platform audit log"
        description="Every action taken by platform staff — link generations, promotions, demotions. Append-only, showing the most recent 200 entries."
      />

      {entries.length === 0 ? (
        <AdminEmptyState>No platform audit log entries yet.</AdminEmptyState>
      ) : (
        <AdminTable>
          <AdminTableHeader>
            <AdminTableHeaderCell>When</AdminTableHeaderCell>
            <AdminTableHeaderCell>Actor</AdminTableHeaderCell>
            <AdminTableHeaderCell>Action</AdminTableHeaderCell>
            <AdminTableHeaderCell>Target</AdminTableHeaderCell>
            <AdminTableHeaderCell>Details</AdminTableHeaderCell>
          </AdminTableHeader>
          <AdminTableBody>
            {entries.map((entry) => (
              <AdminTableRow key={entry.id} className="align-top">
                <AdminTableCell className="whitespace-nowrap text-gray-400">{entry.createdAt.toLocaleString()}</AdminTableCell>
                <AdminTableCell>{actorEmailById.get(entry.actorUserId) ?? "Unknown"}</AdminTableCell>
                <AdminTableCell mono>{entry.action}</AdminTableCell>
                <AdminTableCell>{entry.targetEmail ?? "—"}</AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-gray-500" mono title={JSON.stringify(entry.metadata)}>
                  {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  );
}
