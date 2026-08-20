"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
    >
      Print
    </button>
  );
}
