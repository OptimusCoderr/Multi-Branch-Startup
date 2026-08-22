import Link from "next/link";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { deactivateWarehouse } from "@/server/actions/warehouses";
import { getPlanFeaturesForCompany } from "@/server/services/plan-limit-service";
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
import { Warehouse } from "lucide-react";

export default async function WarehousesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const [warehouses, { maxWarehouses }] = await Promise.all([
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    getPlanFeaturesForCompany(membership.companyId),
  ]);

  const canManage = permissions.has(PERMISSIONS.WAREHOUSES_MANAGE);
  const activeCount = warehouses.filter((w) => w.isActive).length;
  const atLimit = maxWarehouses !== undefined && activeCount >= maxWarehouses;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Warehouses"
        description={maxWarehouses !== undefined ? `${activeCount} of ${maxWarehouses} used on your plan${atLimit ? " — upgrade for more" : ""}` : undefined}
        actions={canManage && <LinkButton href="/warehouses/new">New warehouse</LinkButton>}
      />
      {atLimit && (
        <Link href="/settings/billing" className="-mt-4 text-sm font-medium text-amber-700 underline">
          Upgrade for more warehouses
        </Link>
      )}

      {warehouses.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No warehouses yet"
          description="And that's fine — plenty of single-branch shops never need one and stock their branch directly (Transfers → Record external delivery). Add a warehouse only if you want a separate storage or distribution point that feeds multiple branches."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Address</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {warehouses.map((w) => (
              <TableRow key={w.id}>
                <TableCell>{w.name}</TableCell>
                <TableCell className="text-gray-500">{w.address ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={w.isActive ? "success" : "neutral"}>{w.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-3">
                    {canManage && (
                      <>
                        <LinkButton href={`/warehouses/${w.id}`} variant="link">
                          Edit
                        </LinkButton>
                        <form action={deactivateWarehouse.bind(null, w.id)}>
                          <Button type="submit" variant="danger-link">
                            {w.isActive ? "Deactivate" : "Reactivate"}
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
