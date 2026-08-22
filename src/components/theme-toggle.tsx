"use client";

import { useEffect, useState, useTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/server/actions/theme";

/**
 * Reads its initial state from the DOM (the `dark` class the root layout
 * already applied server-side from the theme cookie — see
 * src/lib/theme.ts) rather than a prop, so it drops into any surface
 * (marketing header, auth shell, app sidebar) without that surface's own
 * layout needing to thread a value through. Renders a neutral placeholder
 * until mounted to avoid a hydration mismatch between server and client.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // The server-rendered `dark` class (from the theme cookie) is the real
    // source of truth here — this just mirrors it into state once mounted
    // so the icon/aria-label can react to it, deliberately skipping SSR to
    // avoid a hydration mismatch between server and client.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see company-name-field.tsx's identical justification
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    startTransition(() => {
      void setTheme(next ? "dark" : "light");
    });
  }

  if (isDark === null) {
    return <span aria-hidden="true" className={`inline-block h-8 w-8 ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
