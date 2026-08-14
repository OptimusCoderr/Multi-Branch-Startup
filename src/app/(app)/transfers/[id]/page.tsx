import { notFound } from "next/navigation";
import { requireMembership, computeEffectivePermissions } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { approveTransfer, dispatchTransfer, cancelTransfer } from "@/server/actions/transfers";
import { RejectTransferForm } from "@/components/forms/reject-transfer-form";
import { ReceiveTransferForm } from "@/components/forms/receive-transfer-form";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-indigo-100 text-indigo-700",
  RECEIVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const permissions = await computeEffectivePermissions(membership.membershipId);
  const db = getScopedPrisma(membership.companyId);

  const transfer = await db.stockTransfer.findUnique({
    where: { id },
    include: { product: true, sourceWarehouse: true, destinationBranch: true },
  });
  if (!transfer) notFound();

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
        <p className="mt-1 text-sm text-gray-500">
          {transfer.quantity} units · {transfer.sourceType === "EXTERNAL" ? `External: ${transfer.externalSourceName}` : transfer.sourceWarehouse?.name}{" "}
          → {transfer.destinationBranch.name}
        </p>
        {transfer.notes && <p className="mt-2 text-sm text-gray-600">Notes: {transfer.notes}</p>}
        {hasDiscrepancy && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Discrepancy: {transfer.receivedQuantity} received vs {transfer.quantity} requested.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-semibold uppercase text-gray-400">Timeline</p>
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
              <p className="text-sm text-gray-500">
                You requested this transfer — another staff member with approval rights must approve it.
              </p>
            )}
            {canApprove && !isSelfApproval && (
              <div className="flex flex-col gap-3">
                <form action={approveTransfer.bind(null, transfer.id)}>
                  <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
                    Approve
                  </button>
                </form>
                <RejectTransferForm transferId={transfer.id} />
              </div>
            )}
            {(isRequester || canApprove) && (
              <form action={cancelTransfer.bind(null, transfer.id)}>
                <button type="submit" className="text-sm text-gray-500 hover:underline">
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
                <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
                  Mark as dispatched
                </button>
              </form>
            )}
            {canReceive && (
              <div>
                <p className="mb-2 text-sm text-gray-500">
                  Receiving now (without a separate dispatch step) will move the stock directly.
                </p>
                <ReceiveTransferForm transferId={transfer.id} expectedQuantity={transfer.quantity} />
              </div>
            )}
            {(isRequester || canApprove) && (
              <form action={cancelTransfer.bind(null, transfer.id)}>
                <button type="submit" className="text-sm text-gray-500 hover:underline">
                  Cancel transfer
                </button>
              </form>
            )}
          </>
        )}

        {transfer.status === "IN_TRANSIT" && canReceive && (
          <ReceiveTransferForm transferId={transfer.id} expectedQuantity={transfer.quantity} />
        )}
      </div>
    </div>
  );
}
