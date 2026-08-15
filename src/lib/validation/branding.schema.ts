import { z } from "zod";
import { emptyToUndefined } from "./shared";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Enter a color as a 6-digit hex code, e.g. #171717");

export const brandingSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: z.preprocess(emptyToUndefined, hexColor.optional()),
  logoUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Enter a valid URL").optional()),
  layoutPreset: z.enum(["DEFAULT", "COMPACT"]),
});
export type BrandingInput = z.infer<typeof brandingSchema>;
