import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { requireMobileMembership, requireMobilePermission, handleApiError, ApiError } from "@/lib/api/mobile-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { customerSchema } from "@/lib/validation/customer.schema";
import { getCustomerBalances } from "@/server/services/customer-service";
import { writeAuditLog } from "@/server/services/audit-service";

export async function GET() {
  try {
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_VIEW);

    const db = getScopedPrisma(membership.companyId);
    const customers = await db.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    const balances = await getCustomerBalances(db, customers.map((c) => c.id));

    return NextResponse.json({
      customers: customers.map((c) => {
        const balance = balances.get(c.id);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          outstanding: (balance?.outstanding ?? 0).toString(),
          overdueSaleCount: balance?.overdueSaleCount ?? 0,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const membership = await requireMobileMembership();
    await requireMobilePermission(membership.membershipId, PERMISSIONS.CUSTOMERS_MANAGE);

    const body = await request.json().catch(() => null);
    if (!body) throw new ApiError("Invalid JSON body.", 400);

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid customer details.", 400);
    }

    const db = getScopedPrisma(membership.companyId);
    let customerId = "";

    await db.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          companyId: membership.companyId,
          name: parsed.data.name,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          address: parsed.data.address ?? null,
          notes: parsed.data.notes ?? null,
          creditLimit: parsed.data.creditLimit ?? null,
          remindersEnabled: parsed.data.remindersEnabled,
        },
      });
      customerId = customer.id;

      await writeAuditLog(tx, {
        companyId: membership.companyId,
        actorMembershipId: membership.membershipId,
        action: "customer.created",
        entityType: "Customer",
        entityId: customer.id,
        metadata: { name: customer.name, source: "mobile" },
      });
    });

    return NextResponse.json({ customerId }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
