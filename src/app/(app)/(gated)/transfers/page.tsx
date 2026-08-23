import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  PageHeader,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  LinkButton,
  EmptyState,
  type BadgeVariant,
} from "@/components/ui";
import { ArrowLeftRight } from "lucide-react";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  REQUESTED: "warning",
  APPROVED: "brand",
  IN_TRANSIT: "brand",
  RECEIVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function TransfersPage() {
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const transfers = await db.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true, sourceWarehouse: true, sourceBranch: true, destinationBranch: true, destinationWarehouse: true },
    take: 100,
  });

  const canRequest = permissions.has(PERMISSIONS.TRANSFERS_REQUEST);
  const canReceiveExternal = permissions.has(PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock transfers"
        actions={
          <>
            {canReceiveExternal && (
              <LinkButton href="/transfers/new-external" variant="secondary">
                Record external delivery
              </LinkButton>
            )}
            {canRequest && <LinkButton href="/transfers/new">Request transfer</LinkButton>}
          </>
        }
      />

      {transfers.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transfers yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Qty</TableHeaderCell>
            <TableHeaderCell>From</TableHeaderCell>
            <TableHeaderCell>To</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {transfers.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.product.name}</TableCell>
                <TableCell mono>{t.quantity}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">
                  {t.sourceType === "EXTERNAL"
                    ? `External: ${t.externalSourceName}`
                    : t.sourceType === "BRANCH"
                      ? t.sourceBranch?.name
                      : t.sourceType === "WAREHOUSE"
                        ? t.sourceWarehouse?.name
                        : "Awaiting reviewer"}
                </TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">
                  {t.destinationBranch ? t.destinationBranch.name : `${t.destinationWarehouse!.name} (warehouse)`}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell align="right">
                  <LinkButton href={`/transfers/${t.id}`} variant="link">
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
