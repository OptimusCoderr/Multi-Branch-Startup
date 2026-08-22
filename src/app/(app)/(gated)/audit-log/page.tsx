import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { PageHeader, Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, EmptyState } from "@/components/ui";
import { History } from "lucide-react";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ entityType?: string }> }) {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.AUDIT_LOG_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view the audit log.</p>;
  }

  const { entityType } = await searchParams;
  const db = getScopedPrisma(membership.companyId);

  const [entries, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);

  const names = await resolveMembershipNames(db, entries.map((e) => e.actorMembershipId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="Every sensitive action taken in this company — append-only, nothing here can be edited or deleted, even by an Owner. Showing the most recent 200 entries."
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href="/audit-log"
          className={`rounded-full px-3 py-1 ${!entityType ? "bg-[var(--brand-primary)] text-white" : "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}
        >
          All
        </a>
        {entityTypes.map((t) => (
          <a
            key={t.entityType}
            href={`/audit-log?entityType=${encodeURIComponent(t.entityType)}`}
            className={`rounded-full px-3 py-1 ${entityType === t.entityType ? "bg-[var(--brand-primary)] text-white" : "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}
          >
            {t.entityType}
          </a>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={History} title={`No audit log entries${entityType ? ` for "${entityType}"` : ""} yet`} />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>When</TableHeaderCell>
            <TableHeaderCell>Actor</TableHeaderCell>
            <TableHeaderCell>Action</TableHeaderCell>
            <TableHeaderCell>Entity</TableHeaderCell>
            <TableHeaderCell>Details</TableHeaderCell>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id} className="align-top">
                <TableCell className="whitespace-nowrap text-gray-500 dark:text-gray-400">{entry.createdAt.toLocaleString()}</TableCell>
                <TableCell>{entry.actorMembershipId ? (names.get(entry.actorMembershipId) ?? "Unknown") : "System"}</TableCell>
                <TableCell mono>{entry.action}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">
                  {entry.entityType} <span className="font-mono text-xs">{entry.entityId.slice(0, 8)}</span>
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400" mono title={JSON.stringify(entry.metadata)}>
                  {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
