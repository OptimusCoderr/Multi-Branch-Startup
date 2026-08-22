"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card } from "@/components/ui";

/**
 * Deliberately distinct from the StatCard grid above it on the dashboard —
 * this is meant to be the one thing worth screenshotting and sharing to a
 * family/staff WhatsApp group at closing time, so it reads as a single,
 * self-contained "here's how today went" statement rather than a metric
 * tile among many.
 */
export function DailySummaryCard({
  companyName,
  dateLabel,
  salesTotal,
  saleCount,
  expensesTotal,
  profitTotal,
  outstandingTotal,
}: {
  companyName: string;
  dateLabel: string;
  salesTotal: string;
  saleCount: number;
  expensesTotal: string;
  profitTotal: string;
  outstandingTotal: string;
}) {
  const [copied, setCopied] = useState(false);
  const profitPositive = !profitTotal.trim().startsWith("-");

  const shareText = `${companyName} — ${dateLabel}\nSales: ${salesTotal} (${saleCount} sale${saleCount === 1 ? "" : "s"})\nExpenses: ${expensesTotal}\nProfit: ${profitTotal}\nOwed to you: ${outstandingTotal}`;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail silently (permissions, non-secure
      // context) — nothing more useful to do than leave the button as-is.
    }
  }

  return (
    <Card className="border-[var(--brand-primary)]/30 bg-gradient-to-br from-[var(--brand-primary)]/5 to-transparent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Today&apos;s summary</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {companyName} · {dateLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={copySummary}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy to share"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Sales</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{salesTotal}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {saleCount} sale{saleCount === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Expenses</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{expensesTotal}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Profit</p>
          <p className={`font-semibold ${profitPositive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{profitTotal}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Owed to you</p>
          <p className="font-semibold text-amber-700 dark:text-amber-400">{outstandingTotal}</p>
        </div>
      </div>
    </Card>
  );
}
