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
      <span className="font-medium text-gray-700">
        {label} {optional && <span className="font-normal text-gray-400">(optional)</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
