import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ entityType?: string }> }) {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.AUDIT_LOG_VIEW)) {
    return <p className="text-gray-500">You don&apos;t have permission to view the audit log.</p>;
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
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every sensitive action taken in this company — append-only, nothing here can be edited or deleted, even by
          an Owner. Showing the most recent 200 entries.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href="/audit-log"
          className={`rounded-full px-3 py-1 ${!entityType ? "bg-[var(--brand-primary)] text-white" : "border border-gray-300 text-gray-600"}`}
        >
          All
        </a>
        {entityTypes.map((t) => (
          <a
            key={t.entityType}
            href={`/audit-log?entityType=${encodeURIComponent(t.entityType)}`}
            className={`rounded-full px-3 py-1 ${entityType === t.entityType ? "bg-[var(--brand-primary)] text-white" : "border border-gray-300 text-gray-600"}`}
          >
            {t.entityType}
          </a>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No audit log entries{entityType ? ` for "${entityType}"` : ""} yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{entry.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {entry.actorMembershipId ? (names.get(entry.actorMembershipId) ?? "Unknown") : "System"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {entry.entityType} <span className="font-mono text-xs">{entry.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-500" title={JSON.stringify(entry.metadata)}>
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
