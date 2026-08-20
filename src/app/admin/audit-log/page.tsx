import { requirePlatformStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AdminAuditLogPage() {
  await requirePlatformStaff();

  const entries = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actorIds = [...new Set(entries.map((e) => e.actorUserId))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } });
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform audit log</h1>
        <p className="mt-1 text-sm text-gray-400">
          Every action taken by platform staff — link generations, promotions, demotions. Append-only, showing the
          most recent 200 entries.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No platform audit log entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-900 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-400">{entry.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-3">{actorEmailById.get(entry.actorUserId) ?? "Unknown"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3 text-gray-300">{entry.targetEmail ?? "—"}</td>
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
