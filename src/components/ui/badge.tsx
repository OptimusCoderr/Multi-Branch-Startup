import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "brand";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  neutral: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  brand: "bg-[var(--brand-primary-subtle,#ede9fe)] text-[var(--brand-primary)]",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}>{children}</span>;
}
