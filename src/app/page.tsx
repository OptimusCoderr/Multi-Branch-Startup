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
  ScanLine,
  ArrowLeftRight,
  Receipt,
  BarChart3,
  UserCog,
  Boxes,
  Building2,
  ScrollText,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { LogoPlaceholder } from "@/components/logo-placeholder";

const FEATURES = [
  { icon: Warehouse, title: "Every location, one view", body: "Branches and warehouses, stock transfers between them, a full accountability trail for every movement." },
  { icon: Users, title: "Staff who see only what they need", body: "Granular per-person permissions — grant or deny access to any feature, in effect on their very next request." },
  { icon: TrendingUp, title: "Sales, debt, and profit at a glance", body: "Partial payments, credit notes, customer debt tracking, and real profit/loss reporting — not just a spreadsheet replacement." },
  { icon: ShieldCheck, title: "Built for accountability", body: "Every stock movement, sale, and staff change is logged — append-only, tamper-evident, never silently rewritten." },
];

const PILLS = [
  "Multi-branch inventory",
  "Barcode scanning",
  "Staff permissions",
  "Stock transfers",
  "Credit notes",
  "Debt reminders",
  "Profit reports",
  "Mobile app",
];

const CLOUD_FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Boxes, label: "Stock levels" },
  { icon: Warehouse, label: "Warehouses" },
  { icon: Building2, label: "Branches" },
  { icon: ArrowLeftRight, label: "Transfers" },
  { icon: ScanLine, label: "Barcode scan" },
  { icon: ShoppingCart, label: "Sales & POS" },
  { icon: Users, label: "Customers" },
  { icon: Receipt, label: "Expenses" },
  { icon: BarChart3, label: "Reports" },
  { icon: UserCog, label: "Staff roles" },
  { icon: ScrollText, label: "Audit log" },
  { icon: Smartphone, label: "Mobile app" },
];

// Precomputed positions for CLOUD_FEATURES arranged evenly around a
// circle (percentage coordinates within a square container) — plain
// trigonometry at module scope, no client-side layout measurement needed.
const CLOUD_POSITIONS = CLOUD_FEATURES.map((_, i) => {
  const angle = (2 * Math.PI * i) / CLOUD_FEATURES.length - Math.PI / 2;
  const radius = 42;
  return {
    left: `${50 + radius * Math.cos(angle)}%`,
    top: `${50 + radius * Math.sin(angle) * 0.82}%`, // slightly flattened to an ellipse — reads better in a wide section
  };
});

// Decorative bar heights for the hero mockup's chart — plain styled divs,
// no chart library, matching the "no new web dependency" approach the
// rest of the design system already uses.
const CHART_BARS = [38, 62, 45, 70, 52, 84, 60, 95, 58, 40, 30, 66];

// Every mockup below is deliberately styled to match this app's *actual*
// (app)/dashboard/page.tsx, forms, and mobile screens — same card/stat-chip
// shape, same violet default brand color — rather than inventing a
// fictional look, so a visitor sees what they genuinely get after sign-up.
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
          <div className="rounded-xl p-3" style={{ background: "linear-gradient(135deg, #7c3aed, #1e1b2e)" }}>
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

// A compact POS/cart mockup — the real create-sale-form / mobile sale
// screen's shape, condensed for the "record a sale" feature section.
function PosMockup() {
  const lines = [
    { name: "Ankara fabric, 6yd", qty: 2, price: "₦24,000" },
    { name: "Kaftan, size L", qty: 1, price: "₦18,500" },
  ];
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-violet-200/30">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold text-gray-900">New sale</p>
        <span className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
          <ScanLine size={11} /> Scan barcode
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {lines.map((line) => (
          <div key={line.name} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-gray-800">{line.name}</p>
              <p className="text-[10px] text-gray-400">Qty {line.qty}</p>
            </div>
            <p className="text-xs font-semibold text-gray-900">{line.price}</p>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500">Total</p>
          <p className="text-sm font-bold text-gray-900">₦66,500</p>
        </div>
        <div className="mt-1 rounded-lg py-2.5 text-center text-xs font-semibold text-white" style={{ background: "var(--accent-gradient)" }}>
          Record sale
        </div>
      </div>
    </div>
  );
}

// A stock-transfer status list mockup — mirrors the real /transfers page.
function TransferMockup() {
  const rows = [
    { product: "Adire tote bag", route: "Warehouse → Lekki branch", status: "In transit", tone: "brand" as const },
    { product: "Beaded sandals", route: "Ikeja → VI branch", status: "Received", tone: "success" as const },
    { product: "Ankara fabric", route: "Warehouse → Ikeja branch", status: "Requested", tone: "warning" as const },
  ];
  const tones = {
    brand: "bg-violet-50 text-violet-700",
    success: "bg-green-50 text-green-700",
    warning: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-violet-200/30">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <ArrowLeftRight size={14} className="text-violet-600" />
        <p className="text-xs font-semibold text-gray-900">Stock transfers</p>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {rows.map((row) => (
          <div key={row.product} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-gray-800">{row.product}</p>
              <p className="text-[10px] text-gray-400">{row.route}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[row.tone]}`}>{row.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  mockup,
  reverse,
  bg,
}: {
  eyebrow: string;
  title: string;
  body: string;
  mockup: React.ReactNode;
  reverse?: boolean;
  bg: string;
}) {
  return (
    <div className={`rounded-3xl p-8 sm:p-12 ${bg}`}>
      <div className={`mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row ${reverse ? "lg:flex-row-reverse" : ""}`}>
        <div className="flex-1 text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">{eyebrow}</p>
          <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{title}</h3>
          <p className="mt-3 max-w-md text-gray-500 lg:max-w-none">{body}</p>
          <Link href="/sign-up" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline">
            Learn more <ArrowRight size={14} />
          </Link>
        </div>
        <div className="flex flex-1 justify-center">{mockup}</div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative flex flex-col overflow-hidden px-4 pb-16 pt-20 text-center sm:pt-28">
        <div
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[42rem] w-[60rem] -translate-x-1/2 rounded-full opacity-[0.09] blur-[110px]"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
        />

        <div className="mx-auto mb-6 flex items-center gap-2.5">
          <LogoPlaceholder size={32} color="#7c3aed" />
          <span className="font-display text-base font-semibold">Multi-Branch Inventory</span>
        </div>

        <h1 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Run every branch{" "}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #7c3aed, #1e1b2e)" }}>
            from one place
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-gray-500">
          Manage products, warehouses, branches, staff, and sales across every location — with a
          full accountability trail for every stock movement. On the web and on your phone.
        </p>
        <div className="mx-auto mt-8 flex flex-wrap justify-center gap-3">
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

        <div className="relative mt-14 -mx-4 overflow-x-auto px-4">
          <div className="mx-auto flex w-max gap-2.5 sm:justify-center">
            {PILLS.map((pill) => (
              <span
                key={pill}
                className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-14 flex w-full max-w-4xl justify-center">
          <div className="relative w-full pb-14 pr-8 sm:pb-20 sm:pr-14">
            <DashboardMockup />
            <div className="absolute -bottom-6 -right-2 sm:-bottom-10 sm:-right-4">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 py-10 sm:py-16">
        <FeatureRow
          eyebrow="Sales & POS"
          title="Record a sale in seconds"
          body="Scan a barcode or search by name, apply discounts, and accept partial payments — every line item tied straight back to stock, at the branch that sold it."
          mockup={<PosMockup />}
          bg="bg-violet-50/60"
        />
        <FeatureRow
          eyebrow="Stock transfers"
          title="Move stock between locations, without losing track of it"
          body="Request a transfer, approve it, and confirm receipt — every step logged, so 'where did this actually end up' always has a real answer."
          mockup={<TransferMockup />}
          reverse
          bg="bg-gray-50"
        />
      </div>

      <div className="relative overflow-hidden bg-gradient-to-b from-violet-50/70 to-white px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-md text-center sm:hidden">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-gray-900">
            One app that has everything your business needs to grow.
          </h2>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
            style={{ background: "var(--accent-gradient)" }}
          >
            Get started
          </Link>
        </div>

        <div className="relative mx-auto hidden h-[560px] max-w-4xl sm:block">
          {CLOUD_FEATURES.map((f, i) => (
            <div
              key={f.label}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
              style={{ left: CLOUD_POSITIONS[i].left, top: CLOUD_POSITIONS[i].top }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-violet-600 shadow-md shadow-violet-200/60">
                <f.icon size={22} strokeWidth={2} />
              </div>
              <p className="text-xs font-medium text-gray-600">{f.label}</p>
            </div>
          ))}

          <div className="absolute left-1/2 top-1/2 w-[min(90%,26rem)] -translate-x-1/2 -translate-y-1/2 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              One app that has everything your business needs to grow.
            </h2>
            <Link
              href="/sign-up"
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
              style={{ background: "var(--accent-gradient)" }}
            >
              Get started
            </Link>
          </div>
        </div>

        {/* Compact wrapped-grid fallback for small screens, where the
            absolute circle above doesn't reflow sensibly. */}
        <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 sm:hidden">
          {CLOUD_FEATURES.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-violet-600 shadow-sm">
                <f.icon size={18} strokeWidth={2} />
              </div>
              <p className="text-[11px] font-medium text-gray-600">{f.label}</p>
            </div>
          ))}
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
