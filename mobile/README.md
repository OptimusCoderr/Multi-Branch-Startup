# Multi-Branch Inventory — Mobile

An Expo (React Native + TypeScript, Expo Router) companion app for already-onboarded staff to
record sales, take payments, check stock, and manage customers/debt from a phone. It talks to the
same Next.js backend as the web app (`../src/app/api/mobile/v1/*`), reusing the exact same
services, permission checks, and tenant scoping — nothing about authorization or business logic is
reimplemented here.

## Scope of this phase

Built: sign in, dashboard, sales (list/create/detail/record payment/credit notes), stock levels
(read-only), customers/debt (list/create/detail), Bluetooth thermal-printer pairing and receipt
printing (invoices and credit notes). **Not yet built on mobile**: company sign-up/onboarding,
products/warehouses/branches CRUD, stock transfers, staff management, billing, branding, and
expenses — all of that still requires the web app for now. This mirrors the same phased approach
the web app was built with; a company's Owner is expected to do initial setup (sign up, create a
company, add branches/products, invite staff) on the web, then staff use the phone for day-to-day
operations.

## Setup

```bash
cd mobile
npm install
```

Set the backend URL the app talks to in `app.json`'s `expo.extra.apiBaseUrl` (defaults to
`http://localhost:3000` for local development against the Next.js dev server — change this to
your deployed URL, and to your machine's LAN IP rather than `localhost` if testing on a physical
device, since `localhost` on the phone means the phone itself).

### Expo Go vs. Development Build

Bluetooth printing (`react-native-ble-plx`) is a native module — **Expo Go cannot run it**, since
Expo Go only ships the fixed set of native modules Expo bundles into it, and can't load a
third-party one at runtime. This app therefore needs a [Development
Build](https://docs.expo.dev/develop/development-builds/introduction/) once you want to test
printing (`npm run android` / `npm run ios`, which run `expo run:android`/`expo run:ios` — these
generate a native project on first run via the `react-native-ble-plx` config plugin in `app.json`,
build it, and install it on a device/emulator/simulator, the same as any bare React Native app).
Every other screen (sales, stock, customers) still runs fine in plain Expo Go (`npm start`, scan
the QR code) if you don't need to touch printing.

## Auth

Uses [`@better-auth/expo`](https://www.better-auth.com/docs/integrations/expo) — the same
Better Auth instance as the web app (`../src/lib/auth/better-auth.ts`), with the `expo()` and
`bearer()` plugins added there specifically to support this app. Since React Native has no
browser-style cookie jar, the Expo client plugin emulates one on top of `expo-secure-store`, and
`lib/api.ts` reads that back out via `authClient.getCookie()` to authenticate its own calls to
`/api/mobile/v1/*`. Session lifetime, revocation, and RBAC all work identically to the web app —
suspending a staff member or revoking a permission takes effect on their phone's next request too,
same as it does in a browser.

## Verifying without a device

This was built and verified in a sandboxed environment with no iOS/Android simulator and no
Bluetooth radio or physical printer available. What *was* verified:

- `npm run typecheck` — clean across the whole app.
- `npx expo export --platform ios` / `--platform android` — Metro successfully bundles the entire
  app (1800+ modules, including `react-native-ble-plx`) into real Hermes bytecode for both
  platforms with zero errors, which catches the overwhelming majority of real breakage (bad
  imports, native module resolution, JSX/syntax errors) short of an actual device render.
- `npx expo prebuild --platform android` — actually runs the `react-native-ble-plx` Expo config
  plugin (not just validates `app.json`'s shape) and confirms the generated
  `AndroidManifest.xml` carries the right permissions: `BLUETOOTH_CONNECT` and a `BLUETOOTH_SCAN`
  with `neverForLocation` (Android 12+, no location permission needed), plus
  `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` capped at `maxSdkVersion=30` as the pre-Android-12
  fallback. The generated `android/` project isn't committed — this is a managed-workflow app;
  `expo prebuild`/`expo run:*` regenerate it on demand.
- The ESC/POS byte-level encoder (`lib/escpos.ts`) is pure logic with no native/RN dependency, so
  it was sanity-checked with plain Node (`npx tsx`) against the actual command bytes: `ESC @` on
  init, `ESC a`/`ESC E`/`GS !` for align/bold/double-height, `GS V 1` for the closing partial cut,
  non-ASCII currency glyphs (`₦`) stripped rather than sent raw (most cheap thermal printers only
  support single-byte code pages and render UTF-8 as garbage), and full invoice/credit-note
  receipts built from realistic sale data render the expected header, totals, credited/balance-due
  lines, and voided-state banner.
- The `/api/mobile/v1/*` endpoints this app calls (including the new credit-note issue/void routes)
  were verified directly via `curl` with a real bearer token — auth, permissions, sale creation,
  payment recording (including overpayment rejection), customer creation, and cross-tenant
  isolation (404s, no leakage) all confirmed server-side. See the root README's Phase 12 entry for
  details.

What was **not** verified, and can't be without real hardware: actually pairing with a Bluetooth
printer, the on-device permission prompts, and a real receipt coming out the other end. The
Bluetooth service (`lib/bluetooth-printer.ts`) is written to the documented
`react-native-ble-plx` API and standard BLE-printer conventions (scan → user picks their device
from a list, since there's no single UUID standard across printer vendors → connect → discover all
services/characteristics → write to the first writable one, chunked to a conservative MTU size with
a small delay between writes), but that logic needs to be run against a real printer to confirm
it actually prints, not just that it compiles. Also **not** verified: the actual on-device UI,
layout, and touch interactions for every other screen. Run it on a Development Build (or Expo Go
for the non-printing screens) and try the real flows before relying on it.

## Project structure

```
app/                    Expo Router file-based routes
  _layout.tsx            Root layout — auth gate, providers
  sign-in.tsx
  (app)/                 Authenticated area (tab navigator)
    _layout.tsx           Tabs + subscription-inactive banner
    index.tsx              Dashboard
    sales/                 Sales (nested stack: list, new, detail — payments, credit notes, print)
    stock.tsx               Stock levels
    customers/               Customers/debt (nested stack: list, new, detail)
    printer.tsx               Bluetooth printer pairing/settings + sign out
lib/
  auth-client.ts          Better Auth Expo client
  api.ts                  Typed fetch wrapper for /api/mobile/v1/*
  use-me.ts                useMe()/useHasPermission() hooks, formatMoney()
  query-client.ts           React Query client
  escpos.ts                 ESC/POS command builder (pure logic, no RN/native dependency)
  bluetooth-printer.ts       BLE scan/pair/print, backed by react-native-ble-plx
```
