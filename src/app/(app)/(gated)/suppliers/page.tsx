import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { archiveSupplier } from "@/server/actions/suppliers";
import {
  PageHeader,
  LinkButton,
  Button,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
} from "@/components/ui";
import { Truck } from "lucide-react";

export default async function SuppliersPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);

  if (!permissions.has(PERMISSIONS.PURCHASE_ORDERS_VIEW)) {
    return <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view suppliers.</p>;
  }

  const db = getScopedPrisma(membership.companyId);
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });

  const canManage = permissions.has(PERMISSIONS.PURCHASE_ORDERS_MANAGE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        actions={
          <>
            <LinkButton href="/purchase-orders" variant="secondary">
              Back to purchase orders
            </LinkButton>
            {canManage && <LinkButton href="/suppliers/new">New supplier</LinkButton>}
          </>
        }
      />

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{s.phone ?? "—"}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{s.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Archived"}</Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-3">
                    {canManage && (
                      <>
                        <LinkButton href={`/suppliers/${s.id}`} variant="link">
                          Edit
                        </LinkButton>
                        <form action={archiveSupplier.bind(null, s.id)}>
                          <Button type="submit" variant="danger-link">
                            {s.isActive ? "Archive" : "Reactivate"}
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
