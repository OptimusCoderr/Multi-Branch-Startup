import "server-only";
import { cookies } from "next/headers";

/**
 * Rendering always reads this cookie, never the database — a Server
 * Component can't write cookies mid-render, so trying to resolve theme
 * from User.theme/BrandingSettings.defaultTheme on every page load would
 * mean either a flash-of-wrong-theme or Edge middleware hitting Postgres
 * on every request. Instead the cookie is kept authoritative and is
 * synced from the database at the two moments that actually change it:
 * signing in (src/server/actions/theme.ts's syncThemeAfterSignIn) and
 * toggling while signed in (setTheme, same file) — both run in a request
 * context that can set cookies. See BrandingSettings.defaultTheme's
 * comment for the one known staleness edge case (an Owner changing the
 * company default doesn't retroactively update members' existing
 * cookies until their next sign-in or toggle).
 */
export const THEME_COOKIE = "theme";

export type ThemeValue = "light" | "dark";

function normalize(value: string | undefined): ThemeValue | null {
  return value === "light" || value === "dark" ? value : null;
}

/** DARK is the global fallback — see the dark-mode-by-default request this implements. */
export function resolveEffectiveTheme(userTheme: "LIGHT" | "DARK" | null | undefined, companyDefaultTheme: "LIGHT" | "DARK" | null | undefined): ThemeValue {
  const resolved = userTheme ?? companyDefaultTheme ?? "DARK";
  return resolved === "LIGHT" ? "light" : "dark";
}

/** For any Server Component (root layout, marketing/auth pages) that just needs to render the right class/state — never throws, always resolves to a concrete value. */
export async function readThemeCookie(): Promise<ThemeValue> {
  const store = await cookies();
  return normalize(store.get(THEME_COOKIE)?.value) ?? "dark";
}
