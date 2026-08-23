import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * A checkbox paired with its own label text and optional description,
 * laid out the way every "opt-in behavior" checkbox in this app already
 * reads (title + a muted explanatory line beneath it) — e.g. product
 * batch-tracking, customer debt reminders.
 */
export function Checkbox({
  label,
  description,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-ring,#c4b5fd)] dark:border-gray-700 dark:bg-gray-900 ${className}`}
        {...props}
      />
      <span>
        {label}
        {description && <span className="block text-xs text-gray-400 dark:text-gray-500">{description}</span>}
      </span>
    </label>
  );
}
