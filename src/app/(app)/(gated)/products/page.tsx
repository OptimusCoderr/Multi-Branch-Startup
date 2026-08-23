import { Package } from "lucide-react";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import { deactivateProduct } from "@/server/actions/products";
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

export default async function ProductsPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const products = await db.product.findMany({ orderBy: { name: "asc" } });

  const canCreate = permissions.has(PERMISSIONS.PRODUCTS_CREATE);
  const canEdit = permissions.has(PERMISSIONS.PRODUCTS_EDIT);
  const canDeactivate = permissions.has(PERMISSIONS.PRODUCTS_DEACTIVATE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        actions={
          <>
            {permissions.has(PERMISSIONS.PRODUCTS_VIEW) && (
              <a href="/api/exports/products" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
                Export CSV
              </a>
            )}
            {canCreate && <LinkButton href="/products/new">New product</LinkButton>}
          </>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first product to start tracking stock across your locations."
          action={canCreate ? <LinkButton href="/products/new">New product</LinkButton> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Price</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell />
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell mono>{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{formatMoney(p.unitPrice.toString(), membership.companyCurrency)}</TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-4">
                    {canEdit && <LinkButton href={`/products/${p.id}`} variant="link">Edit</LinkButton>}
                    {canDeactivate && (
                      <form action={deactivateProduct.bind(null, p.id)}>
                        <Button type="submit" variant="danger-link">
                          {p.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </form>
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
