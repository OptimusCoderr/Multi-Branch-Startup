import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/format";
import {
  PageHeader,
  Card,
  Field,
  Input,
  Button,
  LinkButton,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
  type BadgeVariant,
} from "@/components/ui";
import { Receipt } from "lucide-react";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  CONFIRMED: "warning",
  PARTIALLY_PAID: "brand",
  PAID: "success",
  VOIDED: "neutral",
};

export default async function SalesPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const sales = await db.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: { branch: true },
    take: 100,
  });

  const canRecord = permissions.has(PERMISSIONS.SALES_RECORD);
  const canExport = permissions.has(PERMISSIONS.REPORTS_VIEW);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sales" actions={canRecord && <LinkButton href="/sales/new">New sale</LinkButton>} />

      {canExport && (
        <Card>
          <form action="/api/exports/sales" method="get" className="flex flex-wrap items-end gap-3">
            <Field label="From" optional>
              <Input type="date" name="from" />
            </Field>
            <Field label="To" optional>
              <Input type="date" name="to" />
            </Field>
            <Button type="submit" variant="secondary">
              Export CSV
            </Button>
            <span className="text-xs text-gray-400 dark:text-gray-500">Leave both blank to export every sale, for accounting/tax use.</span>
          </form>
        </Card>
      )}

      {sales.length === 0 ? (
        <EmptyState icon={Receipt} title="No sales yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Invoice</TableHeaderCell>
            <TableHeaderCell>Branch</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
            <TableHeaderCell>Paid</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell mono>{s.saleNumber}</TableCell>
                <TableCell>{s.branch.name}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{s.customerName ?? "—"}</TableCell>
                <TableCell>{formatMoney(s.grandTotal.toString(), membership.companyCurrency)}</TableCell>
                <TableCell>{formatMoney(s.amountPaid.toString(), membership.companyCurrency)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[s.status] ?? "neutral"}>{s.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell align="right">
                  <LinkButton href={`/sales/${s.id}`} variant="link">
                    View
                  </LinkButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
