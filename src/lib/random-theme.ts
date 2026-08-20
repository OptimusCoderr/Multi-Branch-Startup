/**
 * A fresh, tasteful color theme for the sign-up/onboarding pages — the one
 * place in the app with no company to derive branding from yet (Phase 5's
 * BrandingSettings is deliberately never applied there). Picking a random
 * hue and deriving the rest from fixed saturation/lightness bands (rather
 * than randomizing every channel) keeps every result harmonious instead of
 * risking a clashing combination.
 */
export type RandomTheme = {
  from: string;
  to: string;
  accent: string;
};

export function generateRandomTheme(): RandomTheme {
  const hue = Math.floor(Math.random() * 360);
  // A second hue a modest distance away (analogous, not complementary) —
  // far enough to read as a gradient, close enough to stay harmonious.
  const hue2 = (hue + 35 + Math.floor(Math.random() * 30)) % 360;

  return {
    from: `hsl(${hue}, 80%, 60%)`,
    to: `hsl(${hue2}, 75%, 50%)`,
    accent: `hsl(${hue}, 70%, 45%)`,
  };
}
