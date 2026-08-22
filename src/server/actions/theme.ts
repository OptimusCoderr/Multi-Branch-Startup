"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { resolveEffectiveTheme, THEME_COOKIE, type ThemeValue } from "@/lib/theme";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~400 days, the practical cap most browsers honor

/**
 * Flips the theme for this browser immediately (cookie), and — when
 * signed in — persists it to User.theme so it follows the person to their
 * next device. User is not tenant-scoped, so this goes through the raw
 * `prisma` singleton the same way the 2FA actions update User directly,
 * rather than requiring an active company membership (the toggle is
 * reachable from the pre-company marketing/auth pages too).
 */
export async function setTheme(theme: ThemeValue): Promise<void> {
  const store = await cookies();
  store.set(THEME_COOKIE, theme, { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" });

  const session = await getSession();
  if (session) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { theme: theme === "dark" ? "DARK" : "LIGHT" },
    });
  }
}

/**
 * Pulls a returning user's stored preference forward onto a fresh
 * device's cookie, right after their session is established — called
 * from the sign-in and two-factor-verification pages, immediately before
 * navigating into the app, so the very first authenticated paint already
 * reflects their real preference instead of this device's leftover/
 * default cookie value.
 */
export async function syncThemeAfterSignIn(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { theme: true } }),
    prisma.membership.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: { company: { select: { brandingSettings: { select: { defaultTheme: true } } } } },
    }),
  ]);

  const resolved = resolveEffectiveTheme(user?.theme ?? null, membership?.company.brandingSettings?.defaultTheme ?? null);
  const store = await cookies();
  store.set(THEME_COOKIE, resolved, { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" });
}
