import type { ReactNode } from "react";

/**
 * Wraps a single form control with a consistent label/hint/error layout —
 * the control itself (Input/Select/Textarea/Checkbox) is passed as
 * children rather than rendered here, since checkboxes lay out
 * differently from text inputs and this stays usable for both.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700 dark:text-gray-300">
        {label} {optional && <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
