import "server-only";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";

// A vibrant indigo→fuchsia pairing rather than near-black — most
// companies never touch /settings/branding, so this default IS the look
// most of them actually see every day, not just a fallback.
export const DEFAULT_BRANDING = {
  primaryColor: "#6366f1",
  secondaryColor: "#d946ef" as string | null,
  logoUrl: null as string | null,
  layoutPreset: "DEFAULT" as "DEFAULT" | "COMPACT",
};

export async function getBrandingSettings(companyId: string) {
  const db = getScopedPrisma(companyId);
  const settings = await db.brandingSettings.findUnique({ where: { companyId } });
  return settings ?? DEFAULT_BRANDING;
}
