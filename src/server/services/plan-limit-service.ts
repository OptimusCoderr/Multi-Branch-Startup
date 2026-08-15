import "server-only";
import { getSubscriptionForCompany } from "@/lib/billing/subscription-gate";
import { parsePlanFeatures, type PlanFeatures } from "@/lib/billing/plan-features";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

type ScopedClient = Pick<ReturnType<typeof getScopedPrisma>, "branch" | "warehouse" | "membership" | "invitation">;

/**
 * Reads the current plan's caps for a company. Absent (undefined)
 * consistently means "uncapped on this dimension", not zero — a plan
 * that doesn't mention maxStaff at all places no limit on staff seats.
 */
export async function getPlanFeaturesForCompany(companyId: string): Promise<PlanFeatures> {
  const subscription = await getSubscriptionForCompany(companyId);
  if (!subscription) return {};
  return parsePlanFeatures(subscription.plan.features);
}

/**
 * Throws PlanLimitError if creating one more of the given resource would
 * exceed the company's plan. Called from the mutation itself (not just
 * hidden in the UI) — the same "never rely on a hidden button" discipline
 * every other permission/limit check in this codebase follows. Counts
 * only active resources for branches/warehouses; staff seats count ACTIVE
 * memberships plus PENDING invitations — a pending invite already reserves
 * a seat, and it's the Invitation row (not a Membership row) that
 * represents that reservation until it's accepted, since MembershipStatus
 * "INVITED" is never actually set anywhere in this codebase.
 */
export async function assertUnderBranchLimit(db: ScopedClient, companyId: string): Promise<void> {
  const { maxBranches } = await getPlanFeaturesForCompany(companyId);
  if (maxBranches === undefined) return;
  const count = await db.branch.count({ where: { isActive: true } });
  if (count >= maxBranches) {
    throw new PlanLimitError(
      `Your plan allows up to ${maxBranches} branch${maxBranches === 1 ? "" : "es"}. Upgrade your plan to add more.`,
    );
  }
}

export async function assertUnderWarehouseLimit(db: ScopedClient, companyId: string): Promise<void> {
  const { maxWarehouses } = await getPlanFeaturesForCompany(companyId);
  if (maxWarehouses === undefined) return;
  const count = await db.warehouse.count({ where: { isActive: true } });
  if (count >= maxWarehouses) {
    throw new PlanLimitError(
      `Your plan allows up to ${maxWarehouses} warehouse${maxWarehouses === 1 ? "" : "s"}. Upgrade your plan to add more.`,
    );
  }
}

export async function assertUnderStaffLimit(db: ScopedClient, companyId: string): Promise<void> {
  const { maxStaff } = await getPlanFeaturesForCompany(companyId);
  if (maxStaff === undefined) return;
  const [activeCount, pendingInviteCount] = await Promise.all([
    db.membership.count({ where: { status: "ACTIVE" } }),
    db.invitation.count({ where: { status: "PENDING" } }),
  ]);
  const count = activeCount + pendingInviteCount;
  if (count >= maxStaff) {
    throw new PlanLimitError(
      `Your plan allows up to ${maxStaff} staff seat${maxStaff === 1 ? "" : "s"} (including pending invites). Upgrade your plan to add more.`,
    );
  }
}
