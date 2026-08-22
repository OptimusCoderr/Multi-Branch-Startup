import type { TextareaHTMLAttributes } from "react";

const BASE =
  "rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring,#c4b5fd)] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export function Textarea({ className = "", rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={`${BASE} ${className}`} {...props} />;
}
