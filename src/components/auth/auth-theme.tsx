"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { generateRandomTheme, type RandomTheme } from "@/lib/random-theme";
import { LogoPlaceholder } from "@/components/logo-placeholder";

// A fixed, deterministic starting theme — used for the server render AND
// the client's first render before hydration. Randomizing inside
// useState()'s initializer directly would run once on the server and
// again on the client during hydration, each producing a different
// Math.random() result, which React flags as a real hydration mismatch
// (server-rendered inline style != client-rendered inline style). The
// actual randomization happens in the effect below, which only ever runs
// client-side after hydration is already settled — "different every time
// the page opens" still holds, it just kicks in a frame after paint
// instead of being baked into the SSR output.
const DEFAULT_THEME: RandomTheme = { from: "#374151", to: "#111827", accent: "#171717" };

const AuthThemeContext = createContext<RandomTheme>(DEFAULT_THEME);

/** For any client component nested inside AuthThemeShell that wants to match its accent color (buttons, links). */
export function useAuthTheme(): RandomTheme {
  return useContext(AuthThemeContext);
}

/**
 * The sign-up/onboarding pages' shell — a fresh gradient background and a
 * matching accent color, regenerated on every page load. There's no
 * company to derive branding from at this point (Phase 5's
 * BrandingSettings only ever applies once one exists), so instead of a
 * flat neutral page this picks a new harmonious color pairing each time,
 * consumed by nested form buttons via useAuthTheme().
 */
export function AuthThemeShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<RandomTheme>(DEFAULT_THEME);

  useEffect(() => {
    // Deliberately not a "sync with an external system" effect (the usual
    // justification for setState-in-effect) — this is a one-time,
    // client-only randomization that can't run during the initial
    // client/server-matching render without causing a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(generateRandomTheme());
  }, []);

  return (
    <AuthThemeContext.Provider value={theme}>
      <main
        className="flex min-h-screen items-center justify-center p-4 transition-[background] duration-300"
        style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-4 flex justify-center">
            <LogoPlaceholder size={40} color={theme.accent} />
          </div>
          {children}
        </div>
      </main>
    </AuthThemeContext.Provider>
  );
}
