# Multi-Branch Inventory — Mobile

An Expo (React Native + TypeScript, Expo Router) companion app for already-onboarded staff to
record sales, take payments, check stock, and manage customers/debt from a phone. It talks to the
same Next.js backend as the web app (`../src/app/api/mobile/v1/*`), reusing the exact same
services, permission checks, and tenant scoping — nothing about authorization or business logic is
reimplemented here.

## Scope of this phase

Built: sign in, dashboard, sales (list/create/detail/record payment), stock levels (read-only),
customers/debt (list/create/detail). **Not yet built on mobile**: company sign-up/onboarding,
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
device via Expo Go, since `localhost` on the phone means the phone itself).

```bash
npm start
```

Scan the QR code with Expo Go (iOS/Android) to run it on a physical device, or press `i`/`a` in the
terminal for a simulator/emulator if you have Xcode/Android Studio installed.

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

This was built and verified in a sandboxed environment with no iOS/Android simulator available.
What *was* verified:

- `npm run typecheck` — clean across the whole app.
- `npx expo export --platform ios` / `--platform android` — Metro successfully bundles the entire
  app (1700+ modules) into real Hermes bytecode for both platforms with zero errors, which catches
  the overwhelming majority of real breakage (bad imports, native module resolution, JSX/syntax
  errors) short of an actual device render.
- The `/api/mobile/v1/*` endpoints this app calls were verified directly via `curl` with a real
  bearer token — auth, permissions, sale creation, payment recording (including overpayment
  rejection), customer creation, and cross-tenant isolation (404s, no leakage) all confirmed
  server-side. See the root README's Phase 12 entry for details.

What was **not** verified: the actual on-device UI, layout, and touch interactions. Run it via
Expo Go and try the real flows before relying on it.

## Project structure

```
app/                    Expo Router file-based routes
  _layout.tsx            Root layout — auth gate, providers
  sign-in.tsx
  (app)/                 Authenticated area (tab navigator)
    _layout.tsx           Tabs + subscription-inactive banner
    index.tsx              Dashboard
    sales/                 Sales (nested stack: list, new, detail)
    stock.tsx               Stock levels
    customers/               Customers/debt (nested stack: list, new, detail)
lib/
  auth-client.ts          Better Auth Expo client
  api.ts                  Typed fetch wrapper for /api/mobile/v1/*
  use-me.ts                useMe()/useHasPermission() hooks, formatMoney()
  query-client.ts           React Query client
```
