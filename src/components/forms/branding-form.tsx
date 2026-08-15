"use client";

import { useActionState, useState } from "react";
import { updateBranding } from "@/server/actions/branding";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function BrandingForm({
  defaultValues,
}: {
  defaultValues: { primaryColor: string; secondaryColor: string | null; logoUrl: string | null; layoutPreset: string };
}) {
  const [state, formAction, isPending] = useActionState(updateBranding, initialState);
  const [primaryColor, setPrimaryColor] = useState(defaultValues.primaryColor);
  const [logoUrl, setLogoUrl] = useState(defaultValues.logoUrl ?? "");

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <form action={formAction} className="flex max-w-sm flex-1 flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Primary color
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 rounded border border-gray-300"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <span className="text-xs text-gray-400">Used for buttons and links across the app. Pick a color dark enough for white text.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Secondary color (optional)
          <input
            type="color"
            name="secondaryColor"
            defaultValue={defaultValues.secondaryColor ?? primaryColor}
            className="h-9 w-12 rounded border border-gray-300"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Logo URL (optional)
          <input
            name="logoUrl"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Layout
          <select name="layoutPreset" defaultValue={defaultValues.layoutPreset} className="rounded-md border border-gray-300 px-3 py-2">
            <option value="DEFAULT">Default</option>
            <option value="COMPACT">Compact</option>
          </select>
        </label>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          {isPending ? "Saving…" : "Save branding"}
        </button>
      </form>

      <div className="flex-1 rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Preview</p>
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided URL, live preview only
            <img src={logoUrl} alt="Logo preview" className="h-7 w-7 rounded object-cover" />
          )}
          <span className="text-sm font-semibold">Your Company</span>
        </div>
        <button type="button" className="mt-3 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
          Primary action
        </button>
      </div>
    </div>
  );
}
