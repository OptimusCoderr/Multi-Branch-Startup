import "server-only";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";

// A violet→near-black pairing — most companies never touch
// /settings/branding, so this default IS the look most of them actually
// see every day, not just a fallback. Matches the marketing/auth accent
// (see --accent-gradient in globals.css and auth-theme.tsx) so a new
// company's first impression of the app is visually continuous with the
// site they just signed up on, until they pick their own colors.
export const DEFAULT_BRANDING = {
  primaryColor: "#7c3aed",
  secondaryColor: "#1e1b2e" as string | null,
  logoUrl: null as string | null,
  layoutPreset: "DEFAULT" as "DEFAULT" | "COMPACT",
  defaultTheme: "DARK" as "LIGHT" | "DARK",
};

export async function getBrandingSettings(companyId: string) {
  const db = getScopedPrisma(companyId);
  const settings = await db.brandingSettings.findUnique({ where: { companyId } });
  return settings ?? DEFAULT_BRANDING;
}
