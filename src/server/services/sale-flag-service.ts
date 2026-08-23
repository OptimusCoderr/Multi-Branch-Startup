import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { resolveBusinessDay } from "@/lib/business-day";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "sale" | "saleFlag" | "membership" | "company">;

export class SaleFlagStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleFlagStateError";
  }
}

export class SaleFlagNotFoundError extends Error {
  constructor() {
    super("Flag not found.");
    this.name = "SaleFlagNotFoundError";
  }
}

/**
 * A reviewer flags a specific sale after the fact — the exception path
 * (not a review gate every sale goes through). Sets a same-day deadline
 * (midnight, Company.timezone) for the original submitter to correct and
 * resubmit; see resolveSaleFlag and the deadline-check cron
 * (escalateOverdueFlags) for what happens next.
 */
export async function flagSale(tx: ScopedTx, companyId: string, membershipId: string, saleId: string, reason: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw new SaleFlagStateError("Sale not found.");
  if (sale.status === "VOIDED") {
    throw new SaleFlagStateError("A voided sale cannot be flagged.");
  }
  if (sale.soldByMembershipId === membershipId) {
    throw new SaleFlagStateError("You cannot flag a sale you recorded yourself.");
  }

  const openFlag = await tx.saleFlag.findFirst({ where: { saleId, status: { in: ["FLAGGED", "ESCALATED"] } } });
  if (openFlag) {
    throw new SaleFlagStateError("This sale already has an open flag.");
  }

  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { timezone: true } });
  const deadline = resolveBusinessDay(company.timezone).endUtc;

  const flag = await tx.saleFlag.create({
    data: { companyId, saleId, flaggedByMembershipId: membershipId, reason, deadline, status: "FLAGGED" },
  });

  return { flag, sale };
}

/**
 * "Edit and resubmit" is deliberately narrow — only the customer-identifying
 * fields are corrected in place (see SaleFlag's schema comment for why line
 * items/prices are never touched here). Eligibility: before the deadline,
 * only the original submitter (or Owner/Admin, who can act anytime) may
 * resolve; once escalated, resolve rights open to Cashier/Branch
 * Manager/Admin as well (Owner already always could).
 */
export async function resolveSaleFlag(
  tx: ScopedTx,
  membershipId: string,
  flagId: string,
  input: { customerName?: string; customerPhone?: string; customerEmail?: string; dueDate?: Date | null; note: string },
) {
  const flag = await tx.saleFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new SaleFlagNotFoundError();
  if (flag.status === "RESOLVED") {
    throw new SaleFlagStateError("This flag has already been resolved.");
  }

  const sale = await tx.sale.findUniqueOrThrow({ where: { id: flag.saleId } });
  const resolver = await tx.membership.findUnique({ where: { id: membershipId }, include: { role: true } });
  const resolverRole = resolver?.role?.name;
  const isOwnerOrAdmin = resolver?.role?.isSystem && (resolverRole === "Owner" || resolverRole === "Admin");
  const isOriginalSubmitter = sale.soldByMembershipId === membershipId;
  const isPastDeadline = flag.status === "ESCALATED" || flag.deadline <= new Date();
  const isWidenedRole = resolver?.role?.isSystem && (resolverRole === "Cashier" || resolverRole === "Branch Manager" || resolverRole === "Admin");

  const eligible = isOwnerOrAdmin || isOriginalSubmitter || (isPastDeadline && isWidenedRole);
  if (!eligible) {
    throw new SaleFlagStateError("You're not able to resolve this flag yet — only the original submitter (or an Owner/Admin) can, until the deadline passes.");
  }

  const updatedSale = await tx.sale.update({
    where: { id: sale.id },
    data: {
      ...(input.customerName !== undefined && { customerName: input.customerName }),
      ...(input.customerPhone !== undefined && { customerPhone: input.customerPhone }),
      ...(input.customerEmail !== undefined && { customerEmail: input.customerEmail }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
    },
  });

  const updatedFlag = await tx.saleFlag.update({
    where: { id: flagId },
    data: { status: "RESOLVED", resolvedByMembershipId: membershipId, resolvedAt: new Date(), resolutionNote: input.note },
  });

  return { flag: updatedFlag, sale: updatedSale };
}

/**
 * Run by the deadline-check cron (see /api/cron/sale-flag-deadlines), once
 * per company. Every still-open flag whose deadline has passed gets
 * escalated — the caller (the cron route) is responsible for the
 * Branch-Manager/Owner notifications this triggers, since that needs the
 * tenant-scoped membership list this function's minimal ScopedTx doesn't
 * fetch on its own.
 */
export async function escalateOverdueFlags(tx: ScopedTx, companyId: string) {
  const overdue = await tx.saleFlag.findMany({ where: { companyId, status: "FLAGGED", deadline: { lte: new Date() } } });
  const escalated = [];
  for (const flag of overdue) {
    const updated = await tx.saleFlag.update({ where: { id: flag.id }, data: { status: "ESCALATED", escalatedAt: new Date() } });
    escalated.push(updated);
  }
  return escalated;
}
