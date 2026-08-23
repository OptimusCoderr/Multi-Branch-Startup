"use client";

import { useState } from "react";
import { useAuthTheme } from "@/components/auth/auth-theme";

const BUSINESS_TYPES = [
  "Retail / General store",
  "Wholesale / Distribution",
  "Restaurant / Food & beverage",
  "Fashion / Boutique",
  "Pharmacy / Health",
  "Electronics / Gadgets",
  "Salon / Beauty",
  "Services",
  "Manufacturing",
  "Other",
] as const;

const INPUT_CLASS =
  "rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950";

/** businessType input, shared by both places a company gets created — a curated dropdown for the common cases, with a free-text field for anything else. */
export function CompanyBusinessTypeField() {
  const { accent } = useAuthTheme();
  const [selection, setSelection] = useState("");
  const [customValue, setCustomValue] = useState("");
  const isOther = selection === "Other";

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        Business type
        <select
          name={isOther ? undefined : "businessType"}
          required
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className={INPUT_CLASS}
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        >
          <option value="" disabled>
            Select a business type
          </option>
          {BUSINESS_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {isOther && (
        <input
          name="businessType"
          required
          placeholder="Describe your business type"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          className={`${INPUT_CLASS} mt-1`}
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        />
      )}
    </div>
  );
}
