import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, requireActiveSubscription, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

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
      },
    });
    if (!sale) throw new ApiError("Sale not found.", 404);

    return NextResponse.json({
      id: sale.id,
      saleNumber: sale.saleNumber,
      branchName: sale.branch.name,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      status: sale.status,
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
    });
  } catch (err) {
    return handleApiError(err);
  }
}
