import type { ReactNode } from "react";
import { requireMembership } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembership();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm font-semibold">{membership.companyName}</p>
          <p className="text-xs text-gray-500">{membership.roleName ?? "Staff"}</p>
        </div>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
