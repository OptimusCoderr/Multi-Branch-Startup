import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link" | "danger-link";
export type ButtonSize = "sm" | "md";

const SOLID_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover,#4338ca)] focus-visible:ring-[var(--brand-ring,#818cf8)]",
  secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400",
  ghost: "text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400",
  link: "text-sm font-medium text-[var(--brand-primary)] hover:underline disabled:no-underline",
  "danger-link": "text-sm font-medium text-red-600 hover:underline disabled:no-underline",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const isLinkStyle = (variant: ButtonVariant) => variant === "link" || variant === "danger-link";

function classesFor(variant: ButtonVariant, size: ButtonSize, className: string) {
  if (isLinkStyle(variant)) return `${VARIANT_CLASSES[variant]} ${className}`;
  return `${SOLID_BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swapped in for `children` while a useActionState/form transition is pending — also disables the button. */
  isPending?: boolean;
  pendingLabel?: ReactNode;
  children: ReactNode;
};

/** Submits a form or fires an onClick — for a styled navigation link, use LinkButton instead. */
export function Button({
  variant = "primary",
  size = "md",
  isPending = false,
  pendingLabel,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} disabled={disabled || isPending} className={classesFor(variant, size, className)} {...props}>
      {isPending ? (pendingLabel ?? children) : children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={classesFor(variant, size, className)}>
      {children}
    </Link>
  );
}
