import Link from "next/link";

const LINKS = [
  { href: "/settings/branding", label: "Branding" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/debt-reminders", label: "Debt reminders" },
  { href: "/settings/verification", label: "Verification" },
  { href: "/settings/security", label: "Security" },
];

export function SettingsNav({ current }: { current: string }) {
  return (
    <nav className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-2 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={link.href === current ? "font-medium text-[var(--brand-primary)]" : "text-gray-500 dark:text-gray-400 hover:text-[var(--brand-primary)]"}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
