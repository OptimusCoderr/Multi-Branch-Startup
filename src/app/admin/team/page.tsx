import { requireSuperAdminWithTwoFactor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PromoteStaffForm } from "@/components/forms/promote-staff-form";
import { DemoteStaffButton } from "@/components/forms/demote-staff-button";
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

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SUPPORT_AGENT: "Support agent",
};

export default async function AdminTeamPage() {
  const admin = await requireSuperAdminWithTwoFactor();

  const staff = await prisma.user.findMany({
    where: { platformRole: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, platformRole: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Platform team" description="Who can see /admin — super admins and support agents." />

      <PromoteStaffForm />

      {staff.length === 0 ? (
        <AdminEmptyState>No platform staff yet.</AdminEmptyState>
      ) : (
        <AdminTable>
          <AdminTableHeader>
            <AdminTableHeaderCell>Name</AdminTableHeaderCell>
            <AdminTableHeaderCell>Email</AdminTableHeaderCell>
            <AdminTableHeaderCell>Role</AdminTableHeaderCell>
            <AdminTableHeaderCell>Added</AdminTableHeaderCell>
            <AdminTableHeaderCell align="right"></AdminTableHeaderCell>
          </AdminTableHeader>
          <AdminTableBody>
            {staff.map((member) => (
              <AdminTableRow key={member.id}>
                <AdminTableCell className="font-medium text-gray-100">{member.name}</AdminTableCell>
                <AdminTableCell>{member.email}</AdminTableCell>
                <AdminTableCell>{ROLE_LABEL[member.platformRole!]}</AdminTableCell>
                <AdminTableCell className="text-gray-400">{member.createdAt.toLocaleDateString()}</AdminTableCell>
                <AdminTableCell align="right">{member.id !== admin.userId && <DemoteStaffButton userId={member.id} />}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  );
}
