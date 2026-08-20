import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformStaff } from "@/lib/auth/session";
import { AdminSignOutButton } from "@/components/layout/admin-sign-out-button";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SUPPORT_AGENT: "Support agent",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requirePlatformStaff();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
              {ROLE_LABEL[staff.role]}
            </span>
            <p className="text-sm font-semibold">{staff.email}</p>
          </div>
          <nav className="flex gap-4 text-sm text-gray-400">
            <Link href="/admin" className="hover:text-white">
              Companies
            </Link>
            <Link href="/admin/support" className="hover:text-white">
              Support
            </Link>
            {staff.role === "SUPER_ADMIN" && (
              <Link href="/admin/team" className="hover:text-white">
                Team
              </Link>
            )}
          </nav>
        </div>
        <AdminSignOutButton />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
