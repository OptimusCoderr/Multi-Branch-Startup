/**
 * Shared accent palette — the mobile counterpart to the web app's default
 * --brand-primary/--brand-secondary (src/lib/branding.ts). Mobile has no
 * per-company branding of its own yet (that's still web-only), so this is
 * a fixed pairing rather than dynamic, but it's the same indigo→fuchsia
 * identity so the two platforms read as one product.
 */
export const theme = {
  primary: "#6366f1",
  primaryDark: "#4f46e5",
  secondary: "#d946ef",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  gradient: ["#6366f1", "#d946ef"] as const,
};
