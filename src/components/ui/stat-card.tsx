import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tint,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tint: string;
  href?: Route;
}) {
  const content = (
    <>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        // color-mix() rather than string-concatenating an alpha hex suffix
        // (`${tint}1a`) — that only produces valid CSS when tint is a hex
        // literal; a tint passed as a CSS var() (var(--brand-primary))
        // would mangle into "var(--brand-primary)1a", an invalid value the
        // browser silently drops. color-mix() works uniformly for both.
        style={{ backgroundColor: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
      >
        <Icon size={18} strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-gray-900">{value}</p>
        {detail && <p className="mt-0.5 text-xs text-gray-500">{detail}</p>}
      </div>
    </>
  );
  const className = "flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
