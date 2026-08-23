import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { dispatchTransfer, cancelTransfer } from "@/server/actions/transfers";
import { RejectTransferForm } from "@/components/forms/reject-transfer-form";
import { ReceiveTransferForm } from "@/components/forms/receive-transfer-form";
import { ApproveTransferForm } from "@/components/forms/approve-transfer-form";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400",
  APPROVED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  IN_TRANSIT: "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400",
  RECEIVED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  REJECTED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  CANCELLED: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const transfer = await db.stockTransfer.findUnique({
    where: { id },
    include: { product: true, sourceWarehouse: true, sourceBranch: true, destinationBranch: true, destinationWarehouse: true },
  });
  if (!transfer) notFound();

  // A transfer's batch identity is only known for certain once dispatch
  // has actually happened (IN_TRANSIT) — before that (APPROVED, not yet
  // dispatched), both a branch and a warehouse source are trusted to
  // auto-carry a batch-tracked product's identity forward the same way,
  // same as this app already trusted branch sources to. Only once
  // dispatchedBatches comes back empty for an IN_TRANSIT transfer do we
  // know for sure the source had no matching batch rows to consume from.
  const carriedBatchCount = Array.isArray(transfer.dispatchedBatches) ? transfer.dispatchedBatches.length : 0;
  const requiresManualBatch = transfer.product.tracksBatches && transfer.status === "IN_TRANSIT" && carriedBatchCount === 0;

  const [approveWarehouses, approveBranches] = await Promise.all([
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({
      where: { isActive: true, id: { not: transfer.destinationBranchId ?? undefined } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const names = await resolveMembershipNames(db, [
    transfer.requestedByMembershipId,
    transfer.approvedByMembershipId,
    transfer.rejectedByMembershipId,
    transfer.dispatchedByMembershipId,
    transfer.receivedByMembershipId,
    transfer.cancelledByMembershipId,
  ]);
  const nameOf = (mid: string | null) => (mid ? (names.get(mid) ?? "Unknown") : null);

  const canApprove = permissions.has(PERMISSIONS.TRANSFERS_APPROVE);
  const canDispatch = permissions.has(PERMISSIONS.TRANSFERS_DISPATCH);
  const canReceive = permissions.has(PERMISSIONS.TRANSFERS_RECEIVE);
  const isRequester = transfer.requestedByMembershipId === membership.membershipId;
  const isSelfApproval = isRequester && transfer.status === "REQUESTED";
  const hasDiscrepancy = transfer.receivedQuantity !== null && transfer.receivedQuantity !== transfer.quantity;

  // Blind receiving: someone who can ONLY receive transfers (not also
  // approve or dispatch them) has no legitimate prior reason to know the
  // requested quantity — showing it to them before they count would make
  // receiving a rubber stamp. Anyone who also holds approve/dispatch
  // rights already knows what was requested from doing that step, so
  // hiding it from them would only break their own workflow for no
  // benefit. Once the transfer is RECEIVED, the number is shown to
  // everyone — blinding only matters before the count is submitted.
  const isReceiveOnlyViewer = canReceive && !canApprove && !canDispatch;
  const hideRequestedQuantity = isReceiveOnlyViewer && transfer.status !== "RECEIVED";

  const events: { label: string; detail: string }[] = [
    { label: "Requested", detail: `${nameOf(transfer.requestedByMembershipId)} · ${transfer.requestedAt.toLocaleString()}` },
  ];
  if (transfer.approvedAt) {
    events.push({ label: "Approved", detail: `${nameOf(transfer.approvedByMembershipId)} · ${transfer.approvedAt.toLocaleString()}` });
  }
  if (transfer.rejectedAt) {
    events.push({
      label: "Rejected",
      detail: `${nameOf(transfer.rejectedByMembershipId)} · ${transfer.rejectedAt.toLocaleString()} — ${transfer.rejectionReason}`,
    });
  }
  if (transfer.dispatchedAt) {
    events.push({ label: "Dispatched", detail: `${nameOf(transfer.dispatchedByMembershipId)} · ${transfer.dispatchedAt.toLocaleString()}` });
  }
  if (transfer.receivedAt) {
    events.push({
      label: "Received",
      detail: `${nameOf(transfer.receivedByMembershipId)} · ${transfer.receivedAt.toLocaleString()} — ${transfer.receivedQuantity} units${hasDiscrepancy ? ` (requested ${transfer.quantity})` : ""}`,
    });
  }
  if (transfer.cancelledAt) {
    events.push({ label: "Cancelled", detail: `${nameOf(transfer.cancelledByMembershipId)} · ${transfer.cancelledAt.toLocaleString()}` });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{transfer.product.name}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[transfer.status] ?? ""}`}>
            {transfer.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {!hideRequestedQuantity && <>{transfer.quantity} units · </>}
          {transfer.sourceType === "EXTERNAL"
            ? `External: ${transfer.externalSourceName}`
            : transfer.sourceType === "BRANCH"
              ? transfer.sourceBranch?.name
              : transfer.sourceType === "WAREHOUSE"
                ? transfer.sourceWarehouse?.name
                : "Awaiting reviewer"}{" "}
          → {transfer.destinationBranch ? transfer.destinationBranch.name : `${transfer.destinationWarehouse!.name} (warehouse)`}
        </p>
        {transfer.notes && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Notes: {transfer.notes}</p>}
        {hasDiscrepancy && (
          <p className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            Discrepancy: {transfer.receivedQuantity} received vs {transfer.quantity} requested.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Timeline</p>
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {events.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.label}:</span> {e.detail}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-4">
        {transfer.status === "REQUESTED" && (
          <>
            {isSelfApproval && canApprove && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You requested this transfer — another staff member with approval rights must approve it.
              </p>
            )}
            {canApprove && !isSelfApproval && (
              <div className="flex flex-col gap-3">
                <ApproveTransferForm
                  transferId={transfer.id}
                  warehouses={approveWarehouses}
                  branches={approveBranches}
                  requiresBatch={transfer.product.tracksBatches}
                />
                <RejectTransferForm transferId={transfer.id} />
              </div>
            )}
            {(isRequester || canApprove) && (
              <form action={cancelTransfer.bind(null, transfer.id)}>
                <button type="submit" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
                  Cancel request
                </button>
              </form>
            )}
          </>
        )}

        {transfer.status === "APPROVED" && (
          <>
            {canDispatch && (
              <form action={dispatchTransfer.bind(null, transfer.id)}>
                <button type="submit" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
                  Mark as dispatched
                </button>
              </form>
            )}
            {canReceive && (
              <div>
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  Receiving now (without a separate dispatch step) will move the stock directly.
                  {hideRequestedQuantity && " Count what physically arrived — the requested quantity isn't shown until after you submit your count."}
                </p>
                <ReceiveTransferForm transferId={transfer.id} requiresManualBatch={requiresManualBatch} />
              </div>
            )}
            {(isRequester || canApprove) && (
              <form action={cancelTransfer.bind(null, transfer.id)}>
                <button type="submit" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
                  Cancel transfer
                </button>
              </form>
            )}
          </>
        )}

        {transfer.status === "IN_TRANSIT" && canReceive && (
          <div>
            {hideRequestedQuantity && (
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                Count what physically arrived — the requested quantity isn&apos;t shown until after you submit your count.
              </p>
            )}
            <ReceiveTransferForm transferId={transfer.id} />
          </div>
        )}
      </div>
    </div>
  );
}
