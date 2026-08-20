import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getCustomerBalance } from "@/server/services/customer-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_VIEW);

    const db = getScopedPrisma(membership.companyId);
    const customer = await db.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError("Customer not found.", 404);

    const [balance, sales] = await Promise.all([
      getCustomerBalance(db, customer.id),
      db.sale.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        include: { branch: { select: { name: true } } },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      remindersEnabled: customer.remindersEnabled,
      outstanding: balance.outstanding.toString(),
      openSaleCount: balance.openSaleCount,
      overdueSaleCount: balance.overdueSaleCount,
      sales: sales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        branchName: s.branch.name,
        status: s.status,
        grandTotal: s.grandTotal.toString(),
        amountPaid: s.amountPaid.toString(),
        dueDate: s.dueDate?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
