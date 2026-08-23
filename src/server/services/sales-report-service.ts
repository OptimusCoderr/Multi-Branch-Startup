import "server-only";
import { Prisma } from "@prisma/client";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { resolveBusinessDay, businessDayToDate } from "@/lib/business-day";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "dailySalesReport" | "sale" | "payment" | "company" | "branch">;

export class SalesReportNotFoundError extends Error {
  constructor() {
    super("Sales report not found.");
    this.name = "SalesReportNotFoundError";
  }
}

export class SalesReportStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesReportStateError";
  }
}

async function getCompanyTimezone(tx: ScopedTx, companyId: string): Promise<string> {
  const company = await tx.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  return company?.timezone ?? "Africa/Lagos";
}

/**
 * Called from sale-service.ts's createSale, before a Sale is created, for
 * any non-Owner/Admin recorder — Owner/Admin are exempt (see
 * isOwnerOrAdminMembership, src/lib/auth/session.ts). Blocks a further sale
 * once today's report for this (staff, branch) is SUBMITTED/APPROVED/
 * REJECTED; SENT_BACK deliberately reopens the day so the staff can act on
 * the Owner's note (void a wrong sale, issue a credit note) before
 * resubmitting.
 */
export async function assertNoOpenReportBlockingSale(tx: ScopedTx, companyId: string, membershipId: string, branchId: string): Promise<void> {
  const timezone = await getCompanyTimezone(tx, companyId);
  const { dateKey } = resolveBusinessDay(timezone);

  const existing = await tx.dailySalesReport.findUnique({
    where: {
      companyId_branchId_membershipId_reportDate: {
        companyId,
        branchId,
        membershipId,
        reportDate: businessDayToDate(dateKey),
      },
    },
    select: { status: true },
  });

  if (existing && existing.status !== "SENT_BACK") {
    throw new SalesReportStateError(
      "You've already submitted today's sales report for this branch — ask an Owner to send it back if you need to record more.",
    );
  }
}

type ReportTotals = {
  salesCount: number;
  grossSalesTotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  paymentsCollected: Prisma.Decimal;
  cashCollected: Prisma.Decimal;
};

/**
 * Pure read — computed fresh from Sale/Payment every time (submission and
 * any "preview before you submit" read), never cached or client-supplied.
 * Sales: this staff's non-voided sales at this branch, created today.
 * Payments: this staff's payments recorded today, for sales at this branch
 * (a payment can land on an older credit sale, so it's joined via sale.branchId
 * rather than filtered by the sale's own createdAt).
 */
export async function computeDailySalesReportTotals(
  tx: ScopedTx,
  companyId: string,
  branchId: string,
  membershipId: string,
  dayRange: { startUtc: Date; endUtc: Date },
): Promise<ReportTotals> {
  const [salesAgg, paymentsAgg, cashAgg] = await Promise.all([
    tx.sale.aggregate({
      where: {
        companyId,
        branchId,
        soldByMembershipId: membershipId,
        status: { not: "VOIDED" },
        createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
      },
      _count: { _all: true },
      _sum: { grandTotal: true, discountTotal: true },
    }),
    tx.payment.aggregate({
      where: {
        companyId,
        recordedByMembershipId: membershipId,
        paidAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        sale: { branchId },
      },
      _sum: { amount: true },
    }),
    tx.payment.aggregate({
      where: {
        companyId,
        recordedByMembershipId: membershipId,
        mode: "CASH",
        paidAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        sale: { branchId },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    salesCount: salesAgg._count._all,
    grossSalesTotal: salesAgg._sum.grandTotal ?? new Prisma.Decimal(0),
    discountTotal: salesAgg._sum.discountTotal ?? new Prisma.Decimal(0),
    paymentsCollected: paymentsAgg._sum.amount ?? new Prisma.Decimal(0),
    cashCollected: cashAgg._sum.amount ?? new Prisma.Decimal(0),
  };
}

/**
 * Creates a fresh report, or — if today's report for this (staff, branch)
 * is SENT_BACK — updates it in place with freshly recomputed totals and a
 * new submission cycle. A second *fresh* submission for the same day is
 * naturally rejected by the table's unique constraint (surfaced here as a
 * friendly error) since createSale's own lock (assertNoOpenReportBlockingSale)
 * should already have prevented reaching this point in that case.
 */
export async function submitDailySalesReport(
  tx: ScopedTx,
  companyId: string,
  membershipId: string,
  branchId: string,
  input: { declaredCash?: Prisma.Decimal; staffNote?: string },
) {
  const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!branch) throw new SalesReportStateError("Selected branch not found.");

  const timezone = await getCompanyTimezone(tx, companyId);
  const businessDay = resolveBusinessDay(timezone);
  const reportDate = businessDayToDate(businessDay.dateKey);

  const totals = await computeDailySalesReportTotals(tx, companyId, branchId, membershipId, businessDay);
  const cashDiscrepancy = input.declaredCash !== undefined ? input.declaredCash.sub(totals.cashCollected) : null;

  const existing = await tx.dailySalesReport.findUnique({
    where: { companyId_branchId_membershipId_reportDate: { companyId, branchId, membershipId, reportDate } },
  });

  if (existing && existing.status !== "SENT_BACK") {
    throw new SalesReportStateError("Today's sales report for this branch has already been submitted.");
  }

  const data = {
    salesCount: totals.salesCount,
    grossSalesTotal: totals.grossSalesTotal,
    discountTotal: totals.discountTotal,
    paymentsCollected: totals.paymentsCollected,
    cashCollected: totals.cashCollected,
    declaredCash: input.declaredCash ?? null,
    cashDiscrepancy,
    staffNote: input.staffNote ?? null,
    status: "SUBMITTED" as const,
    submittedAt: new Date(),
    respondedByMembershipId: null,
    respondedAt: null,
    ownerNote: null,
  };

  if (existing) {
    return tx.dailySalesReport.update({ where: { id: existing.id }, data });
  }

  return tx.dailySalesReport.create({
    data: { companyId, branchId, membershipId, reportDate, ...data },
  });
}

/** Only valid from SUBMITTED. SEND_BACK requires a note — the staff needs to know what to fix. */
export async function respondToDailySalesReport(
  tx: ScopedTx,
  membershipId: string,
  reportId: string,
  action: "APPROVE" | "SEND_BACK" | "REJECT",
  note?: string,
) {
  const report = await tx.dailySalesReport.findUnique({ where: { id: reportId } });
  if (!report) throw new SalesReportNotFoundError();
  if (report.status !== "SUBMITTED") {
    throw new SalesReportStateError("Only a submitted report can be responded to.");
  }
  if (action === "SEND_BACK" && !note?.trim()) {
    throw new SalesReportStateError("A note is required when sending a report back.");
  }

  const status = action === "APPROVE" ? "APPROVED" : action === "SEND_BACK" ? "SENT_BACK" : "REJECTED";

  return tx.dailySalesReport.update({
    where: { id: reportId },
    data: {
      status,
      ownerNote: note ?? null,
      respondedByMembershipId: membershipId,
      respondedAt: new Date(),
    },
  });
}
