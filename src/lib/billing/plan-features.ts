/**
 * Shape of Plan.features (a Json column) — the seat/resource caps that
 * distinguish subscription tiers. A missing/undefined key means
 * unlimited, not zero, so a plan can leave a dimension uncapped entirely.
 */
export type PlanFeatures = {
  maxBranches?: number;
  maxWarehouses?: number;
  maxStaff?: number;
};

export function parsePlanFeatures(features: unknown): PlanFeatures {
  if (!features || typeof features !== "object") return {};
  const f = features as Record<string, unknown>;
  return {
    maxBranches: typeof f.maxBranches === "number" ? f.maxBranches : undefined,
    maxWarehouses: typeof f.maxWarehouses === "number" ? f.maxWarehouses : undefined,
    maxStaff: typeof f.maxStaff === "number" ? f.maxStaff : undefined,
  };
}
