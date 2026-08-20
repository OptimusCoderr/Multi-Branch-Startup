import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { AdminSignOutButton } from "@/components/layout/admin-sign-out-button";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Platform admin
          </span>
          <p className="text-sm font-semibold">Every company, read-only</p>
        </div>
        <AdminSignOutButton />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
