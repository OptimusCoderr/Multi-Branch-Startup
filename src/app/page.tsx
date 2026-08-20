import Link from "next/link";
import { ArrowRight, Warehouse, Users, ShieldCheck, TrendingUp } from "lucide-react";
import { LogoPlaceholder } from "@/components/logo-placeholder";

const FEATURES = [
  { icon: Warehouse, title: "Every location, one view", body: "Branches and warehouses, stock transfers between them, a full accountability trail for every movement." },
  { icon: Users, title: "Staff who see only what they need", body: "Granular per-person permissions — grant or deny access to any feature, in effect on their very next request." },
  { icon: TrendingUp, title: "Sales, debt, and profit at a glance", body: "Partial payments, credit notes, customer debt tracking, and real profit/loss reporting — not just a spreadsheet replacement." },
  { icon: ShieldCheck, title: "Built for accountability", body: "Every stock movement, sale, and staff change is logged — append-only, tamper-evident, never silently rewritten." },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{ background: "var(--accent-gradient)" }}
        />
        <div className="mb-6 flex items-center gap-2.5">
          <LogoPlaceholder size={36} color="#6366f1" />
          <span className="font-display text-lg font-semibold">Multi-Branch Inventory</span>
        </div>
        <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Run every branch{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--accent-gradient)" }}
          >
            from one place
          </span>
        </h1>
        <p className="mt-5 max-w-md text-gray-500">
          Manage products, warehouses, branches, staff, and sales across every location — with a
          full accountability trail for every stock movement.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-up"
            className="group flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
            style={{ background: "var(--accent-gradient)" }}
          >
            Start free trial
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-4 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <f.icon size={20} strokeWidth={2.25} />
              </div>
              <div>
                <p className="font-display font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-gray-500">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
