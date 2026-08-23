import { requireMembership, computeEffectivePermissions, isOwnerMembership } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveBusinessDay, resolveBusinessWeek } from "@/lib/business-day";
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

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from: fromParam, to: toParam } = await searchParams;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);
  const company = await db.company.findUniqueOrThrow({ where: { id: membership.companyId }, select: { timezone: true } });

  const canRecord = permissions.has(PERMISSIONS.SALES_RECORD);
  const canExport = permissions.has(PERMISSIONS.SALES_EXPORT);
  const canDateSearch = permissions.has(PERMISSIONS.SALES_DATE_SEARCH);
  const canSeeReports = permissions.has(PERMISSIONS.SALES_REPORTS_SUBMIT) || permissions.has(PERMISSIONS.SALES_REPORTS_VIEW);

  // Every role's sales view has a default window (see below); only
  // Owner/Admin/Branch Manager (SALES_DATE_SEARCH) can widen it with an
  // explicit date search — Cashier is hard-capped to today, full stop, no
  // query params accepted.
  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;
  let rangeLabel: string;
  const searchedFrom = canDateSearch ? (fromParam ?? "") : "";
  const searchedTo = canDateSearch ? (toParam ?? "") : "";

  if (!canDateSearch) {
    const day = resolveBusinessDay(company.timezone);
    rangeStart = day.startUtc;
    rangeEnd = day.endUtc;
    rangeLabel = "Today";
  } else if (searchedFrom || searchedTo) {
    rangeStart = searchedFrom ? resolveBusinessDay(company.timezone, new Date(`${searchedFrom}T12:00:00.000Z`)).startUtc : undefined;
    rangeEnd = searchedTo ? resolveBusinessDay(company.timezone, new Date(`${searchedTo}T12:00:00.000Z`)).endUtc : undefined;
    rangeLabel = "Custom range";
  } else if (isOwnerMembership(membership)) {
    // Owner's default is an unrestricted custom range, not a fixed window.
    rangeLabel = "All sales";
  } else {
    // Admin / Branch Manager default to the current calendar week.
    const week = resolveBusinessWeek(company.timezone);
    rangeStart = week.startUtc;
    rangeEnd = week.endUtc;
    rangeLabel = "This week";
  }

  const sales = await db.sale.findMany({
    where: rangeStart || rangeEnd ? { createdAt: { ...(rangeStart && { gte: rangeStart }), ...(rangeEnd && { lt: rangeEnd }) } } : {},
    orderBy: { createdAt: "desc" },
    include: { branch: true },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales"
        actions={
          <>
            {canSeeReports && (
              <LinkButton href="/sales/reports" variant="secondary">
                Daily reports
              </LinkButton>
            )}
            {canRecord && <LinkButton href="/sales/new">New sale</LinkButton>}
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing: <span className="font-medium text-gray-700 dark:text-gray-300">{rangeLabel}</span> ({sales.length} sale
            {sales.length === 1 ? "" : "s"})
          </p>
          {canDateSearch && (
            <form className="flex flex-wrap items-end gap-3" method="get">
              <Field label="From" optional>
                <Input type="date" name="from" defaultValue={searchedFrom} />
              </Field>
              <Field label="To" optional>
                <Input type="date" name="to" defaultValue={searchedTo} />
              </Field>
              <Button type="submit" variant="secondary">
                Search
              </Button>
              {(searchedFrom || searchedTo) && (
                <LinkButton href="/sales" variant="link">
                  Clear
                </LinkButton>
              )}
            </form>
          )}
        </div>
      </Card>

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
        <EmptyState
          icon={Receipt}
          title="No sales yet"
          description={!canDateSearch ? "No sales recorded today." : undefined}
        />
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
