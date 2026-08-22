import Link from "next/link";
import {
  ArrowRight,
  Warehouse,
  Users,
  ShieldCheck,
  TrendingUp,
  ShoppingCart,
  Package,
  Wallet,
  AlertTriangle,
  Bell,
} from "lucide-react";
import { LogoPlaceholder } from "@/components/logo-placeholder";

const FEATURES = [
  { icon: Warehouse, title: "Every location, one view", body: "Branches and warehouses, stock transfers between them, a full accountability trail for every movement." },
  { icon: Users, title: "Staff who see only what they need", body: "Granular per-person permissions — grant or deny access to any feature, in effect on their very next request." },
  { icon: TrendingUp, title: "Sales, debt, and profit at a glance", body: "Partial payments, credit notes, customer debt tracking, and real profit/loss reporting — not just a spreadsheet replacement." },
  { icon: ShieldCheck, title: "Built for accountability", body: "Every stock movement, sale, and staff change is logged — append-only, tamper-evident, never silently rewritten." },
];

// Decorative bar heights for the hero mockup's chart — plain styled divs,
// no chart library, matching the "no new web dependency" approach the
// rest of the design system already uses.
const CHART_BARS = [38, 62, 45, 70, 52, 84, 60, 95, 58, 40, 30, 66];

// The hero mockup below is styled to match this app's *actual*
// (app)/dashboard/page.tsx and mobile (app)/index.tsx — same card/stat-chip
// shape, same violet default brand color — rather than inventing a fictional
// look, so what a visitor sees here is genuinely what they get after sign-up.
function DashboardMockup() {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-violet-200/40 sm:max-w-lg">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="ml-3 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
          <LogoPlaceholder size={13} color="#7c3aed" />
          app.multibranchinventory.com/dashboard
        </span>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-2.5 text-[11px] font-medium text-gray-400">
        <span className="rounded-md bg-violet-50 px-2 py-1 text-violet-700">Dashboard</span>
        <span>Products</span>
        <span>Sales</span>
        <span>Customers</span>
        <span className="hidden sm:inline">Reports</span>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <p className="font-display text-sm font-semibold text-gray-900">Business overview</p>
          <p className="text-[11px] text-gray-400">Today across every branch</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: ShoppingCart, label: "Sales", value: "₦1.24M", tint: "#7c3aed" },
            { icon: Package, label: "Products", value: "289", tint: "#a78bfa" },
            { icon: Users, label: "Customers", value: "136", tint: "#7c3aed" },
            { icon: AlertTriangle, label: "Low stock", value: "3", tint: "#dc2626" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-gray-100 bg-gray-50/70 p-2.5">
              <div
                className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md"
                style={{ backgroundColor: `${stat.tint}1a`, color: stat.tint }}
              >
                <stat.icon size={13} strokeWidth={2.5} />
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{stat.label}</p>
              <p className="text-sm font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sales, last 12 weeks</p>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> vs prior
            </span>
          </div>
          <div className="flex h-20 items-end gap-1.5 sm:gap-2">
            {CHART_BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${h}%`,
                  background: i % 3 === 1 ? "linear-gradient(180deg, #a78bfa, #6d28d9)" : "#e5e7eb",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="w-[184px] rounded-[1.75rem] border-[6px] border-gray-900 bg-gray-900 shadow-2xl shadow-black/30 sm:w-[204px]">
      <div className="overflow-hidden rounded-[1.35rem] bg-white">
        <div className="flex items-center justify-between px-3 pt-2.5 text-[9px] font-medium text-gray-400">
          <span>9:41</span>
          <span className="h-1.5 w-8 rounded-full bg-gray-200" />
        </div>

        <div className="p-3">
          <div
            className="rounded-xl p-3"
            style={{ background: "linear-gradient(135deg, #7c3aed, #1e1b2e)" }}
          >
            <p className="text-[11px] font-semibold text-white">Damen Wears</p>
            <p className="text-[9px] text-white/70">Owner</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { icon: ShoppingCart, label: "Today", value: "₦86k", tint: "#7c3aed" },
              { icon: Wallet, label: "Debt", value: "₦12k", tint: "#a78bfa" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-gray-100 bg-gray-50/70 p-2">
                <div
                  className="mb-1 flex h-5 w-5 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${stat.tint}1a`, color: stat.tint }}
                >
                  <stat.icon size={11} strokeWidth={2.5} />
                </div>
                <p className="text-[7px] font-semibold uppercase tracking-wide text-gray-400">{stat.label}</p>
                <p className="text-[11px] font-semibold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            <Bell size={10} /> Needs attention
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {["Low stock — 3 products", "2 invoices unpaid"].map((item) => (
              <div key={item} className="rounded-lg border border-gray-100 bg-gray-50/70 px-2 py-1.5 text-[9px] text-gray-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative flex flex-1 flex-col overflow-hidden px-4 py-20 sm:py-28">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.09] blur-[110px]"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
        />

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex flex-col items-center text-center lg:w-[46%] lg:items-start lg:text-left">
            <div className="mb-6 flex items-center gap-2.5">
              <LogoPlaceholder size={32} color="#7c3aed" />
              <span className="font-display text-base font-semibold">Multi-Branch Inventory</span>
            </div>
            <h1 className="max-w-xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Run every branch{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #7c3aed, #1e1b2e)" }}>
                from one place
              </span>
            </h1>
            <p className="mt-5 max-w-md text-gray-500">
              Manage products, warehouses, branches, staff, and sales across every location — with a
              full accountability trail for every stock movement. On the web and on your phone.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
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

          <div className="relative flex w-full justify-center lg:w-[54%] lg:justify-end">
            <div className="relative pb-16 pr-10 sm:pb-20 sm:pr-14">
              <DashboardMockup />
              <div className="absolute -bottom-8 -right-2 sm:-bottom-10 sm:-right-4">
                <PhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-4 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
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
