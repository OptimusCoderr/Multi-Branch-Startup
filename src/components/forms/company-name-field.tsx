"use client";

import { useEffect, useState } from "react";
import { suggestCompanyName } from "@/lib/company-name-suggestions";
import { useAuthTheme } from "@/components/auth/auth-theme";

// Same fixed-default-then-randomize-after-mount pattern as AuthThemeShell —
// computing the suggestion via useState's initializer directly would run
// once during the server render and again on the client during hydration,
// producing two different random names and a real hydration mismatch.
const DEFAULT_SUGGESTION = "Golden Gate Stores";

/** The `companyName` input, shared by both places a company gets named (the sign-up flow's company step, and the /onboarding fallback for someone who signed up but didn't finish that step). */
export function CompanyNameField() {
  const { accent } = useAuthTheme();
  const [suggestion, setSuggestion] = useState(DEFAULT_SUGGESTION);
  const [value, setValue] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see AuthThemeShell's identical justification
    setSuggestion(suggestCompanyName());
  }, []);

  return (
    <label className="flex flex-col gap-1 text-sm">
      Company name
      <input
        name="companyName"
        autoFocus
        required
        minLength={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={suggestion}
        className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
        style={{ "--tw-ring-color": accent } as React.CSSProperties}
      />
      <span className="text-xs text-gray-500">
        Need an idea?{" "}
        <button type="button" onClick={() => setValue(suggestion)} className="font-medium underline" style={{ color: accent }}>
          Use &ldquo;{suggestion}&rdquo;
        </button>{" "}
        or{" "}
        <button type="button" onClick={() => setSuggestion(suggestCompanyName())} className="underline">
          shuffle
        </button>
      </span>
    </label>
  );
}
