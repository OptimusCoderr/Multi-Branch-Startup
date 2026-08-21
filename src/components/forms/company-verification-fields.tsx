"use client";

import { useAuthTheme } from "@/components/auth/auth-theme";

/**
 * RC number + incorporation date — both optional, shared by both places a
 * company gets created (the sign-up flow's company step, and the
 * /onboarding fallback). A business without a CAC yet can leave these
 * blank and still operate; submitting a certificate later happens through
 * /settings/verification instead (src/server/actions/verification.ts).
 */
export function CompanyVerificationFields() {
  const { accent } = useAuthTheme();

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        CAC RC number <span className="text-gray-400">(optional)</span>
        <input
          name="rcNumber"
          placeholder="e.g. RC1234567"
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Company incorporation date <span className="text-gray-400">(optional)</span>
        <input
          name="incorporationDate"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        />
      </label>

      <p className="text-xs text-gray-400">
        Don&apos;t have these yet? Leave them blank — you can submit your CAC certificate for verification later
        from Settings.
      </p>
    </>
  );
}
