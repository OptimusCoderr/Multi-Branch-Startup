import type { SelectHTMLAttributes } from "react";

const BASE =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring,#c7d2fe)] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${BASE} ${className}`} {...props}>
      {children}
    </select>
  );
}
