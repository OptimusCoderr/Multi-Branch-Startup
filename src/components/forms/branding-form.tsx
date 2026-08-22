"use client";

import { useActionState, useState } from "react";
import { updateBranding } from "@/server/actions/branding";
import { Field, Input, Select, FormError } from "@/components/ui";

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
        <Field label="Primary color" hint="Used for buttons and links across the app. Pick a color dark enough for white text.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 rounded border border-gray-300"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </Field>

        <Field label="Secondary color" optional>
          <input
            type="color"
            name="secondaryColor"
            defaultValue={defaultValues.secondaryColor ?? primaryColor}
            className="h-9 w-12 rounded border border-gray-300"
          />
        </Field>

        <Field label="Logo URL" optional>
          <Input name="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        </Field>

        <Field label="Layout">
          <Select name="layoutPreset" defaultValue={defaultValues.layoutPreset}>
            <option value="DEFAULT">Default</option>
            <option value="COMPACT">Compact</option>
          </Select>
        </Field>

        <FormError error={state.error} />

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          {isPending ? "Saving…" : "Save branding"}
        </button>
      </form>

      <div className="flex-1 rounded-2xl border border-gray-200 p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</p>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided URL, live preview only
            <img src={logoUrl} alt="Logo preview" className="h-7 w-7 rounded-md object-cover" />
          )}
          <span className="text-sm font-semibold">Your Company</span>
        </div>
        <button type="button" className="mt-3 rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
          Primary action
        </button>
      </div>
    </div>
  );
}
