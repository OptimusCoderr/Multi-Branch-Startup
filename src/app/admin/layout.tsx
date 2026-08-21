import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, LifeBuoy, ScrollText, ShieldCheck, KeyRound } from "lucide-react";
import { requirePlatformStaff } from "@/lib/auth/session";
import { AdminSignOutButton } from "@/components/layout/admin-sign-out-button";
import { LogoPlaceholder } from "@/components/logo-placeholder";
import { AdminBadge } from "@/components/ui-admin";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SUPPORT_AGENT: "Support agent",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requirePlatformStaff();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <LogoPlaceholder size={22} color="#a5b4fc" />
              <AdminBadge variant="brand">{ROLE_LABEL[staff.role]}</AdminBadge>
              <p className="font-display text-sm font-semibold text-gray-100">{staff.email}</p>
            </div>
            <nav className="flex gap-1 text-sm text-gray-400">
              <Link href="/admin" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:bg-gray-800 hover:text-white">
                <Building2 size={16} />
                Companies
              </Link>
              <Link
                href="/admin/support"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:bg-gray-800 hover:text-white"
              >
                <LifeBuoy size={16} />
                Support
              </Link>
              <Link
                href="/admin/audit-log"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:bg-gray-800 hover:text-white"
              >
                <ScrollText size={16} />
                Audit log
              </Link>
              <Link
                href="/admin/security"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:bg-gray-800 hover:text-white"
              >
                <KeyRound size={16} />
                Security
              </Link>
              {staff.role === "SUPER_ADMIN" && (
                <Link
                  href="/admin/team"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:bg-gray-800 hover:text-white"
                >
                  <ShieldCheck size={16} />
                  Team
                </Link>
              )}
            </nav>
          </div>
          <AdminSignOutButton />
        </div>
      </header>
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400" />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
