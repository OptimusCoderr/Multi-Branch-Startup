import type { ReactNode } from "react";

export type CardVariant = "default" | "hover" | "warning" | "danger";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
  hover: "border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  danger: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
};

export function Card({ variant = "default", className = "", children }: { variant?: CardVariant; className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border p-5 shadow-sm ${VARIANT_CLASSES[variant]} ${className}`}>{children}</div>;
}
