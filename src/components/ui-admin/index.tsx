import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * Dark-mode counterpart to src/components/ui/* for the platform-staff
 * /admin section. Deliberately separate: /admin has no per-tenant
 * branding (fixed indigo/fuchsia/amber accent for every platform staff
 * member), so these consume literal colors instead of --brand-* vars.
 */

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export type AdminCardVariant = "default" | "danger";

const CARD_VARIANT_CLASSES: Record<AdminCardVariant, string> = {
  default: "border-gray-800 bg-gray-900",
  danger: "border-red-900 bg-red-950/40",
};

export function AdminCard({
  variant = "default",
  className = "",
  children,
}: {
  variant?: AdminCardVariant;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-2xl border p-5 ${CARD_VARIANT_CLASSES[variant]} ${className}`}>{children}</div>;
}

export type AdminBadgeVariant = "success" | "warning" | "danger" | "neutral" | "brand";

const BADGE_VARIANT_CLASSES: Record<AdminBadgeVariant, string> = {
  success: "bg-green-500/20 text-green-300",
  warning: "bg-amber-500/20 text-amber-300",
  danger: "bg-red-500/20 text-red-300",
  neutral: "bg-gray-500/20 text-gray-400",
  brand: "bg-indigo-500/20 text-indigo-300",
};

export function AdminBadge({ variant = "neutral", children }: { variant?: AdminBadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-gray-800 px-6 py-10 text-center text-sm text-gray-500">{children}</p>;
}

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function AdminTableHeader({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-800 bg-gray-900 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</tr>
    </thead>
  );
}

export function AdminTableHeaderCell({
  children,
  align,
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "right" }) {
  return (
    <th className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : ""} ${className}`} {...props}>
      {children}
    </th>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function AdminTableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b border-gray-900 transition-colors last:border-0 hover:bg-gray-900/60 ${className}`}>{children}</tr>;
}

export function AdminTableCell({
  children,
  align,
  mono,
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "right"; mono?: boolean }) {
  return (
    <td className={`px-4 py-3 text-gray-300 ${align === "right" ? "text-right" : ""} ${mono ? "font-mono text-xs" : ""} ${className}`} {...props}>
      {children}
    </td>
  );
}

export type AdminButtonVariant = "primary" | "secondary" | "danger" | "link" | "danger-link";
export type AdminButtonSize = "sm" | "md";

const SOLID_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANT_CLASSES: Record<AdminButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-400",
  secondary: "border border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 focus-visible:ring-gray-500",
  danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400",
  link: "text-sm font-medium text-indigo-400 hover:underline disabled:no-underline",
  "danger-link": "text-sm font-medium text-red-400 hover:underline disabled:no-underline",
};

const BUTTON_SIZE_CLASSES: Record<AdminButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const isLinkStyle = (variant: AdminButtonVariant) => variant === "link" || variant === "danger-link";

function classesFor(variant: AdminButtonVariant, size: AdminButtonSize, className: string) {
  if (isLinkStyle(variant)) return `${BUTTON_VARIANT_CLASSES[variant]} ${className}`;
  return `${SOLID_BASE} ${BUTTON_VARIANT_CLASSES[variant]} ${BUTTON_SIZE_CLASSES[size]} ${className}`;
}

type AdminButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  isPending?: boolean;
  pendingLabel?: ReactNode;
  children: ReactNode;
};

export function AdminButton({
  variant = "primary",
  size = "md",
  isPending = false,
  pendingLabel,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: AdminButtonProps) {
  return (
    <button type={type} disabled={disabled || isPending} className={classesFor(variant, size, className)} {...props}>
      {isPending ? (pendingLabel ?? children) : children}
    </button>
  );
}

export function AdminLinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={classesFor(variant, size, className)}>
      {children}
    </Link>
  );
}

export function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-400">
      {label}
      {children}
    </label>
  );
}

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 ${props.className ?? ""}`}
    />
  );
}

export function AdminSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 ${props.className ?? ""}`}
    />
  );
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 ${props.className ?? ""}`}
    />
  );
}

export function AdminFormError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm text-red-400">{error}</p>;
}
