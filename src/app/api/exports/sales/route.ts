import { Prisma } from "@prisma/client";
import { requireMembershipOrThrow, computeEffectivePermissions, AuthorizationError } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { toCsv, csvFileResponse } from "@/lib/csv";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

/** Parses a `YYYY-MM-DD` query param into a Date, or null if absent/invalid — an unparsable value is silently ignored rather than erroring, since this only ever narrows an otherwise-unfiltered export. */
function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const membership = await requireMembershipOrThrow();
    const permissions = await computeEffectivePermissions(membership.membershipId);
    if (!permissions.has(PERMISSIONS.REPORTS_VIEW)) {
      throw new AuthorizationError("You don't have permission to export sales.");
    }

    const { searchParams } = new URL(request.url);
    const from = parseDateParam(searchParams.get("from"));
    // The "to" date is a calendar day picked in a date input — treat it as
    // inclusive of the whole day, not midnight at its start.
    const toParam = parseDateParam(searchParams.get("to"));
    const to = toParam ? new Date(toParam.getFullYear(), toParam.getMonth(), toParam.getDate(), 23, 59, 59, 999) : null;

    const db = getScopedPrisma(membership.companyId);
    const sales = await db.sale.findMany({
      where: {
        ...((from || to) && {
          createdAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        }),
      },
      orderBy: { createdAt: "asc" },
      include: { branch: { select: { name: true } } },
    });

    const creditNotes = await db.creditNote.findMany({
      where: { saleId: { in: sales.map((s) => s.id) }, status: "ISSUED" },
      select: { saleId: true, amount: true },
    });
    const creditedBySaleId = new Map<string, Prisma.Decimal>();
    for (const cn of creditNotes) {
      creditedBySaleId.set(cn.saleId, (creditedBySaleId.get(cn.saleId) ?? new Prisma.Decimal(0)).add(cn.amount));
    }

    const soldByNames = await resolveMembershipNames(
      db,
      sales.map((s) => s.soldByMembershipId),
    );

    const rows = sales.map((s) => {
      const credited = creditedBySaleId.get(s.id) ?? new Prisma.Decimal(0);
      const outstanding = s.status === "VOIDED" ? new Prisma.Decimal(0) : s.grandTotal.sub(s.amountPaid).sub(credited);
      return [
        s.saleNumber,
        s.createdAt.toISOString().slice(0, 10),
        s.branch.name,
        s.customerName ?? "",
        s.customerPhone ?? "",
        s.status,
        s.subtotal.toFixed(2),
        s.discountTotal.toFixed(2),
        s.taxTotal.toFixed(2),
        s.grandTotal.toFixed(2),
        s.amountPaid.toFixed(2),
        credited.toFixed(2),
        outstanding.toFixed(2),
        soldByNames.get(s.soldByMembershipId) ?? "",
      ];
    });

    const csv = toCsv(
      [
        "Invoice number",
        "Date",
        "Branch",
        "Customer name",
        "Customer phone",
        "Status",
        "Subtotal",
        "Discount",
        "Tax",
        "Grand total",
        "Amount paid",
        "Credited",
        "Outstanding",
        "Sold by",
      ],
      rows,
    );

    const today = new Date().toISOString().slice(0, 10);
    const rangeSuffix = from || to ? `_${from ? from.toISOString().slice(0, 10) : "start"}_to_${to ? to.toISOString().slice(0, 10) : today}` : "";
    return csvFileResponse(`sales-${membership.companySlug}${rangeSuffix}-exported-${today}.csv`, csv);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return new Response(err.message, { status: 403 });
    }
    throw err;
  }
}
