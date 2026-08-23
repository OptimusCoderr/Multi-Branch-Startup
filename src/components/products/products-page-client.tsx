"use client";

import { useMemo, useState } from "react";
import { Package, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { createProduct, updateProduct, deactivateProduct } from "@/server/actions/products";
import { ProductForm } from "@/components/forms/product-form";
import { AssignProductStockForm } from "@/components/forms/assign-product-stock-form";
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

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unitLabel: string;
  unitPrice: string;
  costPrice: string | null;
  reorderPoint: string | null;
  tracksBatches: boolean;
  isActive: boolean;
};

type ModalState =
  | { type: "create" }
  | { type: "edit"; product: Product }
  | { type: "assign"; product: Product }
  | null;

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
] as const;

export function ProductsPageClient({
  products,
  branches,
  currency,
  categories,
  canCreate,
  canEdit,
  canDeactivate,
  canAssignStock,
}: {
  products: Product[];
  branches: { id: string; name: string }[];
  currency: string;
  categories: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canAssignStock: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [category, setCategory] = useState<string>("all");
  const [view, setView] = useState<"table" | "grid">("table");
  const [modal, setModal] = useState<ModalState>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (status === "active" && !p.isActive) return false;
      if (status === "inactive" && p.isActive) return false;
      if (category !== "all" && (p.category ?? "Uncategorized") !== category) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, status, category]);

  const totalCount = products.length;
  const activeCount = products.filter((p) => p.isActive).length;
  const avgPrice = products.length > 0 ? products.reduce((sum, p) => sum + Number(p.unitPrice), 0) / products.length : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Total products" value={String(totalCount)} tint="var(--brand-primary)" />
        <StatCard icon={Package} label="Active" value={String(activeCount)} detail={`${totalCount - activeCount} inactive`} tint="#16a34a" />
        <StatCard icon={Package} label="Categories" value={String(categories.length)} tint="#2563eb" />
        <StatCard icon={Package} label="Avg. price" value={formatMoney(avgPrice.toFixed(2), currency)} tint="#dc2626" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              style={{ paddingLeft: "2rem" }}
            />
          </div>

          <div className="flex items-center gap-2">
            <a href="/api/exports/products" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
              Export CSV
            </a>
            <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setView("table")}
                aria-label="Table view"
                className={`flex h-8 w-8 items-center justify-center transition-colors ${
                  view === "table" ? "bg-[var(--brand-primary)] text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <ListIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                className={`flex h-8 w-8 items-center justify-center transition-colors ${
                  view === "grid" ? "bg-[var(--brand-primary)] text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
            {canCreate && (
              <Button size="sm" onClick={() => setModal({ type: "create" })}>
                New product
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                status === f.key
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={products.length === 0 ? "No products yet" : "No products match your filters"}
          description={
            products.length === 0
              ? "Add your first product to start tracking stock across your locations."
              : "Try a different search term or clear the filters above."
          }
          action={products.length === 0 && canCreate ? <Button onClick={() => setModal({ type: "create" })}>New product</Button> : undefined}
        />
      ) : view === "table" ? (
        <Table>
          <TableHeader>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>Price</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell />
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell mono>{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.category ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</TableCell>
                <TableCell>{formatMoney(p.unitPrice, currency)}</TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-4">
                    {canAssignStock && (
                      <button
                        type="button"
                        onClick={() => setModal({ type: "assign", product: p })}
                        className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        Assign stock
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setModal({ type: "edit", product: p })}
                        className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {canDeactivate && (
                      <form action={deactivateProduct.bind(null, p.id)}>
                        <button type="submit" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
                          {p.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary-subtle,#ede9fe)] text-[var(--brand-primary)]">
                  <Package size={16} />
                </div>
                <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                <p className="font-mono text-xs text-gray-400 dark:text-gray-500">{p.sku}</p>
                {p.category && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{p.category}</p>}
              </div>
              <p className="font-display text-lg font-semibold text-gray-900 dark:text-gray-100">{formatMoney(p.unitPrice, currency)}</p>
              <div className="mt-auto flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
                {canAssignStock && (
                  <button
                    type="button"
                    onClick={() => setModal({ type: "assign", product: p })}
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    Assign stock
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setModal({ type: "edit", product: p })}
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    Edit
                  </button>
                )}
                {canDeactivate && (
                  <form action={deactivateProduct.bind(null, p.id)}>
                    <button type="submit" className="font-medium text-red-600 hover:underline dark:text-red-400">
                      {p.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === "create" && (
        <Modal title="New product" onClose={() => setModal(null)}>
          <ProductForm action={createProduct} categorySuggestions={categories} submitLabel="Create product" onSuccess={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === "edit" && (
        <Modal title="Edit product" onClose={() => setModal(null)}>
          <ProductForm
            action={updateProduct.bind(null, modal.product.id)}
            categorySuggestions={categories}
            defaultValues={{
              sku: modal.product.sku,
              barcode: modal.product.barcode,
              name: modal.product.name,
              description: modal.product.description,
              category: modal.product.category,
              unitLabel: modal.product.unitLabel,
              unitPrice: modal.product.unitPrice,
              costPrice: modal.product.costPrice,
              reorderPoint: modal.product.reorderPoint,
              tracksBatches: modal.product.tracksBatches,
            }}
            submitLabel="Save changes"
            onSuccess={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "assign" && (
        <Modal title={`Assign stock — ${modal.product.name}`} onClose={() => setModal(null)} size="sm">
          <AssignProductStockForm productId={modal.product.id} branches={branches} onSuccess={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
