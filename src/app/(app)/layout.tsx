import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { requireMembership } from "@/lib/auth/session";
import { getBrandingSettings } from "@/lib/branding";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LogoPlaceholder } from "@/components/logo-placeholder";

// Deliberately NOT trimmed by branch/warehouse count: a company with zero
// warehouses today still needs "Warehouses" in nav to be the one place
// they'd ever discover they can add one later. Hiding it would make that
// path undiscoverable, not just decluttered. The friction this app
// actually had for a single-shop/no-warehouse business — a broken empty
// dropdown on /transfers/new, and dashboard copy that assumed every
// company uses both — is fixed at the source on those pages instead.
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/branches", label: "Branches" },
  { href: "/stock", label: "Stock" },
  { href: "/transfers", label: "Transfers" },
  { href: "/sales", label: "Sales" },
  { href: "/customers", label: "Customers" },
  { href: "/expenses", label: "Expenses" },
  { href: "/staff", label: "Staff" },
  { href: "/settings/branding", label: "Settings" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await requireMembership();
  const branding = await getBrandingSettings(membership.companyId);

  // Company-picked colors flow through as CSS custom properties, consumed
  // by Tailwind's arbitrary-value syntax (bg-[var(--brand-primary)]) on
  // primary actions across the app — never leaks between companies since
  // it's read fresh, scoped by companyId, on every render of this layout.
  const themeStyle = {
    "--brand-primary": branding.primaryColor,
    "--brand-secondary": branding.secondaryColor ?? branding.primaryColor,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-gray-50" style={themeStyle}>
      <header
        data-layout={branding.layoutPreset}
        className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 data-[layout=COMPACT]:py-2 print:hidden"
      >
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            {branding.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={`${membership.companyName} logo`}
                width={28}
                height={28}
                unoptimized
                className="rounded"
              />
            ) : (
              <LogoPlaceholder color={branding.primaryColor} />
            )}
            <div>
              <p className="text-sm font-semibold">{membership.companyName}</p>
              <p className="text-xs text-gray-500">{membership.roleName ?? "Staff"}</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm text-gray-600">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--brand-primary)]">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <SignOutButton />
      </header>
      <main
        data-layout={branding.layoutPreset}
        className="mx-auto max-w-5xl px-6 py-8 data-[layout=COMPACT]:py-4 print:max-w-none print:p-0"
      >
        {children}
      </main>
    </div>
  );
}
