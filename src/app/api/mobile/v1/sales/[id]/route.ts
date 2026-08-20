import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const membership = await requireMobileMembership();
    await requireActiveSubscription(membership.companyId);
    await requireMobilePermission(membership.membershipId, PERMISSIONS.SALES_RECORD);

    const db = getScopedPrisma(membership.companyId);
    const sale = await db.sale.findUnique({
      where: { id },
      include: {
        branch: { select: { name: true } },
        lineItems: { include: { product: { select: { name: true } } } },
        payments: { orderBy: { paidAt: "asc" } },
        creditNotes: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!sale) throw new ApiError("Sale not found.", 404);

    const names = await resolveMembershipNames(
      db,
      sale.creditNotes.flatMap((cn) => [cn.issuedByMembershipId, cn.voidedByMembershipId]),
    );

    return NextResponse.json({
      id: sale.id,
      saleNumber: sale.saleNumber,
      branchName: sale.branch.name,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      status: sale.status,
      voidReason: sale.voidReason,
      subtotal: sale.subtotal.toString(),
      grandTotal: sale.grandTotal.toString(),
      amountPaid: sale.amountPaid.toString(),
      dueDate: sale.dueDate?.toISOString() ?? null,
      createdAt: sale.createdAt.toISOString(),
      lineItems: sale.lineItems.map((li) => ({
        productName: li.product.name,
        quantity: li.quantity,
        unitPriceAtSale: li.unitPriceAtSale.toString(),
        lineTotal: li.lineTotal.toString(),
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        mode: p.mode,
        paidAt: p.paidAt.toISOString(),
      })),
      creditNotes: sale.creditNotes.map((cn) => ({
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        amount: cn.amount.toString(),
        reason: cn.reason,
        status: cn.status,
        issuedByName: names.get(cn.issuedByMembershipId) ?? "Unknown",
        voidedByName: cn.voidedByMembershipId ? (names.get(cn.voidedByMembershipId) ?? "Unknown") : null,
        voidReason: cn.voidReason,
        createdAt: cn.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
