/**
 * Shared accent palette — the mobile counterpart to the web app's default
 * --brand-primary/--brand-secondary (src/lib/branding.ts). Mobile has no
 * per-company branding of its own yet (that's still web-only), so this is
 * a fixed pairing rather than dynamic, but it's the same violet→near-black
 * identity so the two platforms read as one product.
 */
export const theme = {
  primary: "#7c3aed",
  primaryDark: "#5b21b6",
  secondary: "#1e1b2e",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  gradient: ["#7c3aed", "#1e1b2e"] as const,

  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  surface: "#ffffff",
  surfaceMuted: "#f9fafb",

  textPrimary: "#111827",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",

  radius: { sm: 8, md: 10, lg: 14, xl: 20, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  font: { display: 22, h1: 18, h2: 15, body: 14, caption: 12, micro: 11 },

  shadow: {
    sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    md: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  },
} as const;
