import { requireSuperAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PromoteStaffForm } from "@/components/forms/promote-staff-form";
import { DemoteStaffButton } from "@/components/forms/demote-staff-button";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SUPPORT_AGENT: "Support agent",
};

export default async function AdminTeamPage() {
  const admin = await requireSuperAdmin();

  const staff = await prisma.user.findMany({
    where: { platformRole: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, platformRole: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform team</h1>
        <p className="mt-1 text-sm text-gray-400">Who can see /admin — super admins and support agents.</p>
      </div>

      <PromoteStaffForm />

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900 text-gray-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b border-gray-900 last:border-0">
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-gray-300">{member.email}</td>
                <td className="px-4 py-3 text-gray-300">{ROLE_LABEL[member.platformRole!]}</td>
                <td className="px-4 py-3 text-gray-400">{member.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">{member.id !== admin.userId && <DemoteStaffButton userId={member.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && <p className="p-4 text-gray-500">No platform staff yet.</p>}
      </div>
    </div>
  );
}
