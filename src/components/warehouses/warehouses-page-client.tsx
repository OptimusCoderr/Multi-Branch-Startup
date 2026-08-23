"use client";

import { useMemo, useState } from "react";
import { Warehouse as WarehouseIcon, Search, ChevronDown, ChevronUp, PackageSearch } from "lucide-react";
import { formatMoney, formatQuantity, warehouseStockLevel } from "@/lib/format";
import { createWarehouse, updateWarehouse, deactivateWarehouse } from "@/server/actions/warehouses";
import { LocationForm } from "@/components/forms/location-form";
import { AdjustWarehouseStockForm } from "@/components/forms/adjust-warehouse-stock-form";
import {
  StatCard,
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
  Modal,
} from "@/components/ui";

type WarehouseRow = { id: string; name: string; address: string | null; isActive: boolean };
type StockLine = { productId: string; productName: string; productSku: string; unitLabel: string; unitPrice: string; quantity: number };
type ModalState = { type: "create" } | { type: "edit"; warehouse: WarehouseRow } | null;

export function WarehousesPageClient({
  warehouses,
  stockByWarehouse,
  allProducts,
  currency,
  maxWarehouses,
  canManage,
}: {
  warehouses: WarehouseRow[];
  stockByWarehouse: Record<string, StockLine[]>;
  allProducts: { id: string; name: string; sku: string }[];
  currency: string;
  maxWarehouses?: number;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((w) => w.name.toLowerCase().includes(q) || (w.address ?? "").toLowerCase().includes(q));
  }, [warehouses, search]);

  const allLines = useMemo(() => Object.values(stockByWarehouse).flat(), [stockByWarehouse]);
  const stockValue = allLines.reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0);
  const criticalCount = allLines.filter((l) => warehouseStockLevel(l.quantity).variant === "danger").length;
  const activeCount = warehouses.filter((w) => w.isActive).length;
  const atLimit = maxWarehouses !== undefined && activeCount >= maxWarehouses;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={WarehouseIcon} label="Warehouses" value={String(warehouses.length)} detail={`${activeCount} active`} tint="var(--brand-primary)" />
        <StatCard icon={PackageSearch} label="Stock lines" value={String(allLines.length)} tint="#2563eb" />
        <StatCard icon={WarehouseIcon} label="Stock value" value={formatMoney(stockValue.toFixed(2), currency)} tint="#16a34a" />
        <StatCard icon={WarehouseIcon} label="Low / critical" value={String(criticalCount)} tint={criticalCount > 0 ? "#dc2626" : "#6b7280"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search warehouses…" style={{ paddingLeft: "2rem" }} />
        </div>
        {canManage && (
          <Button size="sm" disabled={atLimit} onClick={() => setModal({ type: "create" })}>
            New warehouse
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title={warehouses.length === 0 ? "No warehouses yet" : "No warehouses match your search"}
          description={
            warehouses.length === 0
              ? "And that's fine — plenty of single-branch shops never need one and stock their branch directly. Add a warehouse only if you want a separate storage or distribution point that feeds multiple branches."
              : undefined
          }
          action={warehouses.length === 0 && canManage ? <Button onClick={() => setModal({ type: "create" })}>New warehouse</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((w) => {
            const isOpen = expanded.has(w.id);
            const lines = stockByWarehouse[w.id] ?? [];
            return (
              <div
                key={w.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <button
                  type="button"
                  onClick={() => toggle(w.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary-subtle,#ede9fe)] text-[var(--brand-primary)]">
                      <WarehouseIcon size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{w.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{w.address ?? "No address"} · {lines.length} stock line{lines.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={w.isActive ? "success" : "neutral"}>{w.isActive ? "Active" : "Inactive"}</Badge>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-4 border-t border-gray-100 p-4 dark:border-gray-800">
                    {canManage && (
                      <div className="flex justify-end gap-4 text-sm">
                        <button
                          type="button"
                          onClick={() => setModal({ type: "edit", warehouse: w })}
                          className="font-medium text-[var(--brand-primary)] hover:underline"
                        >
                          Edit
                        </button>
                        <form action={deactivateWarehouse.bind(null, w.id)}>
                          <button type="submit" className="font-medium text-red-600 hover:underline dark:text-red-400">
                            {w.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      </div>
                    )}

                    {lines.length === 0 ? (
                      <EmptyState icon={PackageSearch} title="No stock yet" />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableHeaderCell>Product</TableHeaderCell>
                          <TableHeaderCell>Qty</TableHeaderCell>
                          <TableHeaderCell>Value</TableHeaderCell>
                          <TableHeaderCell>Level</TableHeaderCell>
                        </TableHeader>
                        <TableBody>
                          {lines.map((l) => {
                            const level = warehouseStockLevel(l.quantity);
                            return (
                              <TableRow key={l.productId}>
                                <TableCell>
                                  {l.productName} <span className="font-mono text-xs text-gray-500 dark:text-gray-400">({l.productSku})</span>
                                </TableCell>
                                <TableCell mono>{formatQuantity(l.quantity, l.unitLabel)}</TableCell>
                                <TableCell mono>{formatMoney((Number(l.unitPrice) * l.quantity).toFixed(2), currency)}</TableCell>
                                <TableCell>
                                  <Badge variant={level.variant}>{level.label}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}

                    {canManage && <AdjustWarehouseStockForm products={allProducts} warehouses={[]} fixedWarehouseId={w.id} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === "create" && (
        <Modal title="New warehouse" onClose={() => setModal(null)}>
          <LocationForm action={createWarehouse} submitLabel="Create warehouse" onSuccess={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === "edit" && (
        <Modal title="Edit warehouse" onClose={() => setModal(null)}>
          <LocationForm
            action={updateWarehouse.bind(null, modal.warehouse.id)}
            defaultValues={{ name: modal.warehouse.name, address: modal.warehouse.address }}
            submitLabel="Save changes"
            onSuccess={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
