import type { ReactNode } from "react";
import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/sign-out-button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/branches", label: "Branches" },
  { href: "/stock", label: "Stock" },
  { href: "/transfers", label: "Transfers" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembership();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-sm font-semibold">{membership.companyName}</p>
            <p className="text-xs text-gray-500">{membership.roleName ?? "Staff"}</p>
          </div>
          <nav className="flex gap-4 text-sm text-gray-600">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-black">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
