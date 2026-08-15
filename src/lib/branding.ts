import "server-only";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";

export const DEFAULT_BRANDING = {
  primaryColor: "#171717",
  secondaryColor: null as string | null,
  logoUrl: null as string | null,
  layoutPreset: "DEFAULT" as "DEFAULT" | "COMPACT",
};

export async function getBrandingSettings(companyId: string) {
  const db = getScopedPrisma(companyId);
  const settings = await db.brandingSettings.findUnique({ where: { companyId } });
  return settings ?? DEFAULT_BRANDING;
}
