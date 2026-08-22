/**
 * Shape of Plan.features (a Json column) — the seat/resource caps that
 * distinguish subscription tiers. A missing/undefined key means
 * unlimited, not zero, so a plan can leave a dimension uncapped entirely.
 */
export type PlanFeatures = {
  maxBranches?: number;
  maxWarehouses?: number;
  maxStaff?: number;
  // Debtor-reminder SMS/WhatsApp sends bundled per billing period —
  // separate from the resource caps above since it's consumed (see
  // reminder-credits-service.ts), not just a ceiling. Missing/undefined
  // means the plan bundles none; a company can always top up regardless
  // of plan via a one-time purchase.
  includedReminderCredits?: number;
};

export function parsePlanFeatures(features: unknown): PlanFeatures {
  if (!features || typeof features !== "object") return {};
  const f = features as Record<string, unknown>;
  return {
    maxBranches: typeof f.maxBranches === "number" ? f.maxBranches : undefined,
    maxWarehouses: typeof f.maxWarehouses === "number" ? f.maxWarehouses : undefined,
    maxStaff: typeof f.maxStaff === "number" ? f.maxStaff : undefined,
    includedReminderCredits: typeof f.includedReminderCredits === "number" ? f.includedReminderCredits : undefined,
  };
}
