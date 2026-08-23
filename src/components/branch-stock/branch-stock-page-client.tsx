"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, PackageSearch, ArrowLeftRight, PackagePlus, History, ListChecks } from "lucide-react";
import { formatMoney, formatQuantity, branchStockLevel } from "@/lib/format";
import { dispatchTransfer, cancelTransfer } from "@/server/actions/transfers";
import { RequestTransferForm } from "@/components/forms/request-transfer-form";
import { ApproveTransferForm } from "@/components/forms/approve-transfer-form";
import { RejectTransferForm } from "@/components/forms/reject-transfer-form";
import { ReceiveTransferForm } from "@/components/forms/receive-transfer-form";
import { ReceiveExternalForm } from "@/components/forms/receive-external-form";
import { AdjustBranchStockQuickForm } from "@/components/forms/adjust-branch-stock-quick-form";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  EmptyState,
  Button,
  Input,
  Select,
  Modal,
  useConfirm,
  type BadgeVariant,
} from "@/components/ui";

type StockLine = { productId: string; productName: string; productSku: string; category: string | null; unitLabel: string; unitPrice: string; quantity: number };
type TransferRow = {
  id: string;
  productId: string;
  productName: string;
  productTracksBatches: boolean;
  quantity: number;
  status: string;
  sourceLabel: string | null;
  requestedByMembershipId: string;
  requestedAt: string;
  receivedQuantity: number | null;
  rejectionReason: string | null;
  carriedBatchCount: number;
};
type MyRequestRow = TransferRow & { destinationLabel: string };

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  REQUESTED: "warning",
  APPROVED: "brand",
  IN_TRANSIT: "brand",
  RECEIVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

const TABS = ["Stock", "Pending Requests", "Approval History", "My Requests"] as const;
type Tab = (typeof TABS)[number];

export function BranchStockPageClient({
  membershipId,
  branches,
  selectedBranchId,
  otherBranches,
  warehouses,
  products,
  currency,
  stockRows,
  pendingTransfers,
  historyTransfers,
  myRequests,
  permissions,
}: {
  membershipId: string;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  otherBranches: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; tracksBatches: boolean }[];
  currency: string;
  stockRows: StockLine[];
  pendingTransfers: TransferRow[];
  historyTransfers: TransferRow[];
  myRequests: MyRequestRow[];
  permissions: {
    canView: boolean;
    canRequest: boolean;
    canApprove: boolean;
    canDispatch: boolean;
    canReceive: boolean;
    canReceiveExternal: boolean;
    canAdjustDirectly: boolean;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const showPendingTab = permissions.canApprove || permissions.canDispatch || permissions.canReceive;
  const visibleTabs = TABS.filter((t) => {
    if (t === "Pending Requests" || t === "Approval History") return showPendingTab;
    if (t === "My Requests") return permissions.canRequest;
    return true;
  });
  const [tab, setTab] = useState<Tab>(visibleTabs[0] ?? "Stock");

  function changeBranch(id: string) {
    startTransition(() => router.push(`/branch-stock?branch=${id}`));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Branch</span>
          <Select value={selectedBranchId} onChange={(e) => changeBranch(e.target.value)} disabled={isPending} className="w-56">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
          {visibleTabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t ? "bg-[var(--brand-primary)] text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "Stock" && (
        <StockTab
          selectedBranchId={selectedBranchId}
          stockRows={stockRows}
          products={products}
          warehouses={warehouses}
          branches={branches}
          currency={currency}
          canRequest={permissions.canRequest}
          canAdjustDirectly={permissions.canAdjustDirectly}
          canReceiveExternal={permissions.canReceiveExternal}
        />
      )}

      {tab === "Pending Requests" && (
        <PendingRequestsTab
          transfers={pendingTransfers}
          membershipId={membershipId}
          warehouses={warehouses}
          otherBranches={otherBranches}
          canApprove={permissions.canApprove}
          canDispatch={permissions.canDispatch}
          canReceive={permissions.canReceive}
        />
      )}

      {tab === "Approval History" && <HistoryTab transfers={historyTransfers} />}

      {tab === "My Requests" && <MyRequestsTab requests={myRequests} membershipId={membershipId} canApprove={permissions.canApprove} />}
    </div>
  );
}

function StockTab({
  selectedBranchId,
  stockRows,
  products,
  warehouses,
  branches,
  currency,
  canRequest,
  canAdjustDirectly,
  canReceiveExternal,
}: {
  selectedBranchId: string;
  stockRows: StockLine[];
  products: { id: string; name: string; sku: string; tracksBatches: boolean }[];
  warehouses: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  currency: string;
  canRequest: boolean;
  canAdjustDirectly: boolean;
  canReceiveExternal: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [modal, setModal] = useState<null | "request" | "adjust" | "external">(null);

  const categories = useMemo(() => [...new Set(stockRows.map((s) => s.category).filter((c): c is string => !!c))].sort(), [stockRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stockRows.filter((s) => {
      if (category !== "all" && (s.category ?? "Uncategorized") !== category) return false;
      if (lowOnly && branchStockLevel(s.quantity).variant === "success") return false;
      if (q && !s.productName.toLowerCase().includes(q) && !s.productSku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stockRows, search, category, lowOnly]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock…" style={{ paddingLeft: "2rem" }} />
        </div>
        <div className="flex items-center gap-2">
          {(canAdjustDirectly || canReceiveExternal) && (
            <Button size="sm" variant="secondary" onClick={() => setModal(canAdjustDirectly ? "adjust" : "external")}>
              <PackagePlus size={14} />
              Add stock
            </Button>
          )}
          {canRequest && (
            <Button size="sm" onClick={() => setModal("request")}>
              Request stock
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLowOnly((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            lowOnly ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Low stock only
        </button>
        {categories.length > 0 && <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-800" />}
        {categories.length > 0 && (
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === "all"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            All categories
          </button>
        )}
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={PackageSearch} title={stockRows.length === 0 ? "No stock yet" : "No stock matches your filters"} />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>Qty</TableHeaderCell>
            <TableHeaderCell>Value</TableHeaderCell>
            <TableHeaderCell>Level</TableHeaderCell>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const level = branchStockLevel(s.quantity);
              return (
                <TableRow key={s.productId}>
                  <TableCell>
                    {s.productName} <span className="font-mono text-xs text-gray-500 dark:text-gray-400">({s.productSku})</span>
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">{s.category ?? "—"}</TableCell>
                  <TableCell mono>{formatQuantity(s.quantity, s.unitLabel)}</TableCell>
                  <TableCell mono>{formatMoney((Number(s.unitPrice) * s.quantity).toFixed(2), currency)}</TableCell>
                  <TableCell>
                    <Badge variant={level.variant}>{level.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {modal === "request" && (
        <Modal title="Request stock" onClose={() => setModal(null)}>
          <RequestTransferForm products={products} branches={branches} fixedDestinationBranchId={selectedBranchId} onSuccess={() => setModal(null)} />
        </Modal>
      )}

      {modal === "adjust" && (
        <Modal title="Adjust stock" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            <AdjustBranchStockQuickForm branchId={selectedBranchId} products={products} onSuccess={() => setModal(null)} />
            {canReceiveExternal && (
              <button type="button" onClick={() => setModal("external")} className="self-start text-sm font-medium text-[var(--brand-primary)] hover:underline">
                Record an external delivery instead →
              </button>
            )}
          </div>
        </Modal>
      )}

      {modal === "external" && (
        <Modal title="Record external delivery" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            <ReceiveExternalForm products={products} warehouses={warehouses} branches={branches} fixedBranchId={selectedBranchId} onSuccess={() => setModal(null)} />
            {canAdjustDirectly && (
              <button type="button" onClick={() => setModal("adjust")} className="self-start text-sm font-medium text-[var(--brand-primary)] hover:underline">
                ← Just adjust a count instead
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function PendingRequestsTab({
  transfers,
  membershipId,
  warehouses,
  otherBranches,
  canApprove,
  canDispatch,
  canReceive,
}: {
  transfers: TransferRow[];
  membershipId: string;
  warehouses: { id: string; name: string }[];
  otherBranches: { id: string; name: string }[];
  canApprove: boolean;
  canDispatch: boolean;
  canReceive: boolean;
}) {
  const isReceiveOnlyViewer = canReceive && !canApprove && !canDispatch;

  if (transfers.length === 0) {
    return <EmptyState icon={ListChecks} title="No pending requests" description="Everything for this branch has been handled." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Product</TableHeaderCell>
        <TableHeaderCell>Qty</TableHeaderCell>
        <TableHeaderCell>Source</TableHeaderCell>
        <TableHeaderCell>Status</TableHeaderCell>
        <TableHeaderCell align="right"></TableHeaderCell>
      </TableHeader>
      <TableBody>
        {transfers.map((t) => (
          <PendingRequestRow
            key={t.id}
            transfer={t}
            membershipId={membershipId}
            warehouses={warehouses}
            otherBranches={otherBranches}
            canApprove={canApprove}
            canDispatch={canDispatch}
            canReceive={canReceive}
            isReceiveOnlyViewer={isReceiveOnlyViewer}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function PendingRequestRow({
  transfer: t,
  membershipId,
  warehouses,
  otherBranches,
  canApprove,
  canDispatch,
  canReceive,
  isReceiveOnlyViewer,
}: {
  transfer: TransferRow;
  membershipId: string;
  warehouses: { id: string; name: string }[];
  otherBranches: { id: string; name: string }[];
  canApprove: boolean;
  canDispatch: boolean;
  canReceive: boolean;
  isReceiveOnlyViewer: boolean;
}) {
  const confirm = useConfirm();
  const [modal, setModal] = useState<null | "review" | "receive">(null);
  const [busy, setBusy] = useState(false);
  const isRequester = t.requestedByMembershipId === membershipId;
  const isSelfApproval = isRequester && t.status === "REQUESTED";
  const hideRequestedQuantity = isReceiveOnlyViewer && t.status !== "RECEIVED";
  const requiresManualBatch = t.productTracksBatches && t.status === "IN_TRANSIT" && t.carriedBatchCount === 0;

  async function handleDispatch() {
    const ok = await confirm({ title: "Dispatch this transfer?", message: "This marks the stock as on its way and decrements the source location now." });
    if (!ok) return;
    setBusy(true);
    await dispatchTransfer(t.id);
    setBusy(false);
  }

  async function handleCancel() {
    const ok = await confirm({ title: "Cancel this transfer?", message: "This cannot be undone.", danger: true, confirmText: "Cancel transfer" });
    if (!ok) return;
    setBusy(true);
    await cancelTransfer(t.id);
    setBusy(false);
  }

  return (
    <>
      <TableRow>
        <TableCell>{t.productName}</TableCell>
        <TableCell mono>{hideRequestedQuantity ? "—" : t.quantity}</TableCell>
        <TableCell className="text-gray-500 dark:text-gray-400">{t.sourceLabel ?? "Awaiting reviewer"}</TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANTS[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
        </TableCell>
        <TableCell align="right">
          <div className="flex justify-end gap-3">
            {t.status === "REQUESTED" && canApprove && !isSelfApproval && (
              <button type="button" onClick={() => setModal("review")} className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
                Review
              </button>
            )}
            {t.status === "REQUESTED" && isSelfApproval && <span className="text-xs text-gray-400 dark:text-gray-500">Awaiting reviewer</span>}
            {t.status === "APPROVED" && canDispatch && (
              <button type="button" disabled={busy} onClick={handleDispatch} className="text-sm font-medium text-[var(--brand-primary)] hover:underline disabled:opacity-50">
                Dispatch
              </button>
            )}
            {(t.status === "APPROVED" || t.status === "IN_TRANSIT") && canReceive && (
              <button type="button" onClick={() => setModal("receive")} className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
                Receive
              </button>
            )}
            {(t.status === "REQUESTED" || t.status === "APPROVED") && (isRequester || canApprove) && (
              <button type="button" disabled={busy} onClick={handleCancel} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400">
                Cancel
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {modal === "review" && (
        <tr>
          <td colSpan={5} className="p-0">
            <Modal title={`Review — ${t.productName}`} onClose={() => setModal(null)}>
              <div className="flex flex-col gap-4">
                <ApproveTransferForm
                  transferId={t.id}
                  warehouses={warehouses}
                  branches={otherBranches}
                  requiresBatch={t.productTracksBatches}
                  onSuccess={() => setModal(null)}
                />
                <RejectTransferForm transferId={t.id} onSuccess={() => setModal(null)} />
              </div>
            </Modal>
          </td>
        </tr>
      )}

      {modal === "receive" && (
        <tr>
          <td colSpan={5} className="p-0">
            <Modal title={`Receive — ${t.productName}`} onClose={() => setModal(null)} size="sm">
              <div className="flex flex-col gap-3">
                {hideRequestedQuantity && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Count what physically arrived — the requested quantity isn&apos;t shown until after you submit your count.
                  </p>
                )}
                <ReceiveTransferForm transferId={t.id} requiresManualBatch={requiresManualBatch} onSuccess={() => setModal(null)} />
              </div>
            </Modal>
          </td>
        </tr>
      )}
    </>
  );
}

function HistoryTab({ transfers }: { transfers: TransferRow[] }) {
  if (transfers.length === 0) {
    return <EmptyState icon={History} title="No history yet" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Product</TableHeaderCell>
        <TableHeaderCell>Qty</TableHeaderCell>
        <TableHeaderCell>Source</TableHeaderCell>
        <TableHeaderCell>Status</TableHeaderCell>
        <TableHeaderCell>Detail</TableHeaderCell>
      </TableHeader>
      <TableBody>
        {transfers.map((t) => {
          const hasDiscrepancy = t.receivedQuantity !== null && t.receivedQuantity !== t.quantity;
          return (
            <TableRow key={t.id}>
              <TableCell>{t.productName}</TableCell>
              <TableCell mono>{t.receivedQuantity ?? t.quantity}</TableCell>
              <TableCell className="text-gray-500 dark:text-gray-400">{t.sourceLabel ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
              </TableCell>
              <TableCell className="text-gray-500 dark:text-gray-400">
                {t.status === "REJECTED" && t.rejectionReason}
                {hasDiscrepancy && `Discrepancy: ${t.receivedQuantity} received vs ${t.quantity} requested`}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MyRequestsTab({ requests, membershipId, canApprove }: { requests: MyRequestRow[]; membershipId: string; canApprove: boolean }) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (requests.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="You haven't requested any transfers yet" />;
  }

  async function handleCancel(id: string) {
    const ok = await confirm({ title: "Cancel this request?", message: "This cannot be undone.", danger: true, confirmText: "Cancel request" });
    if (!ok) return;
    setBusyId(id);
    await cancelTransfer(id);
    setBusyId(null);
  }

  return (
    <Table>
      <TableHeader>
        <TableHeaderCell>Product</TableHeaderCell>
        <TableHeaderCell>Qty</TableHeaderCell>
        <TableHeaderCell>To</TableHeaderCell>
        <TableHeaderCell>Status</TableHeaderCell>
        <TableHeaderCell align="right"></TableHeaderCell>
      </TableHeader>
      <TableBody>
        {requests.map((t) => {
          const isRequester = t.requestedByMembershipId === membershipId;
          const canCancel = (t.status === "REQUESTED" || t.status === "APPROVED") && (isRequester || canApprove);
          return (
            <TableRow key={t.id}>
              <TableCell>{t.productName}</TableCell>
              <TableCell mono>{t.quantity}</TableCell>
              <TableCell className="text-gray-500 dark:text-gray-400">{t.destinationLabel}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
              </TableCell>
              <TableCell align="right">
                {canCancel && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => handleCancel(t.id)}
                    className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Cancel
                  </button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
