"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { createBranch, updateBranch, deactivateBranch } from "@/server/actions/branches";
import { LocationForm } from "@/components/forms/location-form";
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

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
};

type ModalState = { type: "create" } | { type: "edit"; branch: Branch } | null;

export function BranchesPageClient({
  branches,
  maxBranches,
  canManage,
}: {
  branches: Branch[];
  maxBranches?: number;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q) || (b.address ?? "").toLowerCase().includes(q));
  }, [branches, search]);

  const activeCount = branches.filter((b) => b.isActive).length;
  const inactiveCount = branches.length - activeCount;
  const atLimit = maxBranches !== undefined && activeCount >= maxBranches;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Total branches" value={String(branches.length)} tint="var(--brand-primary)" />
        <StatCard icon={Building2} label="Active" value={String(activeCount)} tint="#16a34a" />
        <StatCard icon={Building2} label="Inactive" value={String(inactiveCount)} tint="#6b7280" />
        <StatCard
          icon={Building2}
          label="Plan limit"
          value={maxBranches !== undefined ? `${activeCount} / ${maxBranches}` : "Unlimited"}
          detail={atLimit ? "Upgrade for more" : undefined}
          tint={atLimit ? "#dc2626" : "#2563eb"}
          href={atLimit ? "/settings/billing" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search branches…" style={{ paddingLeft: "2rem" }} />
        </div>
        {canManage && (
          <Button size="sm" disabled={atLimit} onClick={() => setModal({ type: "create" })}>
            New branch
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={branches.length === 0 ? "No branches yet" : "No branches match your search"}
          action={branches.length === 0 && canManage ? <Button onClick={() => setModal({ type: "create" })}>New branch</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Address</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right"></TableHeaderCell>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{b.address ?? "—"}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{b.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-3">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModal({ type: "edit", branch: b })}
                          className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
                        >
                          Edit
                        </button>
                        <form action={deactivateBranch.bind(null, b.id)}>
                          <button type="submit" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
                            {b.isActive ? "Deactivate" : "Reactivate"}
                          </button>
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

      {modal?.type === "create" && (
        <Modal title="New branch" onClose={() => setModal(null)}>
          <LocationForm action={createBranch} submitLabel="Create branch" showPhone onSuccess={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === "edit" && (
        <Modal title="Edit branch" onClose={() => setModal(null)}>
          <LocationForm
            action={updateBranch.bind(null, modal.branch.id)}
            defaultValues={{ name: modal.branch.name, address: modal.branch.address, phone: modal.branch.phone }}
            submitLabel="Save changes"
            showPhone
            onSuccess={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
