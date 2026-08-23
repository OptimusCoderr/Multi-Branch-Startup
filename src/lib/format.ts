export function formatMoney(amount: number | string, currency: string): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(Number(amount));
}

/**
 * "3 cartons" / "1 carton" / "45 units" — a merchant-chosen unit label
 * (Product.unitLabel, e.g. "carton", "bag", "dozen") pluralized for
 * display. Naive (+s) rather than a full pluralization library: this is
 * free text a merchant typed for their own trade, not a fixed dictionary,
 * so there's no lookup table to consult — "+s" is right far more often
 * than not and wrong only cosmetically (never affects the actual count).
 */
export function formatQuantity(quantity: number, unitLabel: string): string {
  const label = unitLabel.trim() || "unit";
  const plural = quantity === 1 || label.endsWith("s") ? label : `${label}s`;
  return `${quantity} ${plural}`;
}
