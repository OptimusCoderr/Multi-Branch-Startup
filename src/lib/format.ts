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

/**
 * Purely cosmetic per-location stock-level tiers — distinct from
 * Product.reorderPoint, which drives the actual LOW_STOCK notification and
 * is a single company-wide total across every location. These thresholds
 * only decide which color a quantity renders in on a single warehouse's
 * (or branch's) own stock table; they never gate any business logic.
 */
export type StockLevel = { label: string; variant: "danger" | "warning" | "info" | "success" };

/** 5-tier scale for a warehouse's own stock table. */
export function warehouseStockLevel(qty: number): StockLevel {
  if (qty <= 0) return { label: "Out of stock", variant: "danger" };
  if (qty <= 5) return { label: "Critical", variant: "danger" };
  if (qty <= 20) return { label: "Low", variant: "warning" };
  if (qty <= 50) return { label: "Moderate", variant: "info" };
  return { label: "Good", variant: "success" };
}

/** Coarser 3-tier scale for a branch's own stock table. */
export function branchStockLevel(qty: number): StockLevel {
  if (qty <= 5) return { label: "Critical", variant: "danger" };
  if (qty <= 20) return { label: "Low", variant: "warning" };
  return { label: "OK", variant: "success" };
}
