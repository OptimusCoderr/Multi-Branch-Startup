const PREFIXES = [
  "Golden Gate",
  "Silver Leaf",
  "Crimson Oak",
  "Bright Horizon",
  "Northern Star",
  "Prime",
  "Coral Bay",
  "Amber Fields",
  "Cedarwood",
  "Ivory Coast",
  "Copper Hill",
  "Emerald",
  "Sunrise",
  "Blue Harbor",
  "Everstone",
  "Palm Grove",
  "Riverside",
  "Falcon",
  "Marigold",
  "Union Square",
];

const SUFFIXES = ["Stores", "Trading Co.", "Enterprises", "Ventures", "Mart", "Supplies", "Traders", "Holdings", "Provisions", "& Sons"];

/** A random plausible business name, purely to unstick a first-time signup staring at a blank required field. */
export function suggestCompanyName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}
