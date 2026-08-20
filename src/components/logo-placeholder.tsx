/**
 * Shown wherever a company hasn't uploaded its own logo yet (BrandingSettings.logoUrl
 * is empty) — the app header, and the sign-up/onboarding pages, which have no company
 * to derive one from at all. A generic storefront mark rather than blank space.
 */
export function LogoPlaceholder({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill={color} fillOpacity="0.15" />
      <path
        d="M5 9.5L6 5.5H18L19 9.5M5 9.5V17.5C5 18.0523 5.44772 18.5 6 18.5H18C18.5523 18.5 19 18.0523 19 17.5V9.5M5 9.5H19M9 18.5V13.5C9 12.9477 9.44772 12.5 10 12.5H14C14.5523 12.5 15 12.9477 15 13.5V18.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
