# Multi-Branch Inventory

A multi-tenant inventory management SaaS: companies sign up, manage staff with granular
per-person permissions, run products across warehouses and branches, move stock between
locations with a full accountability trail, record sales with partial/installment payments,
customize their branding, and pay a monthly subscription.

Stack: **Next.js (App Router, TypeScript) + PostgreSQL + Prisma + Better Auth + Paystack**,
shared-database multi-tenancy scoped by `companyId`, deployed to Vercel + managed Postgres.

## Build status

This is being built in phases, each one shipping something testable end-to-end (see
`docs/` — plan lives in project history). Current status:

- [x] **Phase 0 — Foundation**: project scaffolding, Better Auth (email/password), Company /
      Membership / Role / Permission / Invitation schema, seeded permission catalog and
      subscription plans, tenant-isolated Prisma client (`getScopedPrisma`), sign-up →
      company creation → trial subscription flow, authenticated dashboard shell, audit
      logging on company creation.
- [x] **Phase 1 — Catalog**: Product / Warehouse / Branch CRUD, each scoped by
      `getScopedPrisma` and gated by `requirePermission`. Creating a product
      auto-provisions a zeroed stock row at every existing warehouse and
      branch (and vice versa) via `inventory-service.ts`, kept correct by
      splitting per-location stock into `WarehouseStock` / `BranchStock`
      rather than one polymorphic table — Postgres treats `NULL` as
      distinct from `NULL` in unique constraints, so a shared nullable-FK
      table couldn't actually guarantee one row per product/location.
      Verified end-to-end: stock provisioning on both creation orders,
      cross-tenant access returns 404, and a Cashier-role staff member is
      blocked from product/warehouse mutations at both the UI and the
      Server Action layer.
- [x] **Phase 2 — Stock transfers**: full accountability state machine
      (`REQUESTED → APPROVED → IN_TRANSIT → RECEIVED`, or `REJECTED`/`CANCELLED`)
      in `transfer-service.ts`, plus a lighter one-step external-supplier
      intake path. Self-approval is blocked by default (requester ≠
      approver); a `receivedQuantity` that differs from what was requested
      is recorded as-is and flagged with a `transfer.discrepancy` audit
      entry rather than silently corrected. Stock decrements are atomic
      Postgres `UPDATE ... WHERE quantity >= n` statements
      (`decrementWarehouseStock`/`decrementBranchStock`), so concurrent
      transfers racing for the last units can't drive a location negative.
      Also adds a minimal audited stock-adjustment action (`ADJUSTMENT`
      reason) — needed since nothing before Phase 2 had a way to put
      initial stock into a warehouse. Verified end-to-end: full lifecycle
      across two staff members, self-approval blocked, discrepancy
      correctly flagged and audited, the `StockMovement` ledger reconciles
      exactly with `WarehouseStock`/`BranchStock` totals, and cross-tenant
      transfer access returns 404.
- [x] **Phase 3 — Sales & payments**: recording a sale server-computes
      totals from current product prices and snapshots them onto each
      `SaleLineItem` (`unitPriceAtSale`), so a later price change can never
      rewrite a historical invoice. Stock is decremented per line item
      through the same atomic oversell guard used by transfers. Payments
      are an append-only ledger per sale — partial/installment payments
      accumulate via `recordPayment()`, run under Postgres `SERIALIZABLE`
      isolation (the amountPaid/status update is a read-then-write that a
      simple atomic column update can't express, unlike stock decrements),
      so two concurrent payments can't both read a stale balance and
      jointly overpay a sale. Voiding a sale reverses inventory via a
      compensating `StockMovement` and never deletes the original records.
      Verified end-to-end: server-computed totals, atomic sequential
      invoice numbering, oversell prevention, overpayment rejected,
      partial-then-full payment status transitions, void restores stock,
      a role without `sales.record` is blocked, and cross-tenant sale
      access returns 404.
- [x] **Phase 4 — Staff & RBAC UI**: email-invite flow (token stored only
      as a SHA-256 hash, never in plaintext), an accept page that lets a
      brand-new or existing user join without going through company
      onboarding, and a staff detail page where an Owner/Admin can change
      a staff member's role and grant/deny individual permissions on top
      of it — the override UI for the RBAC system every prior phase has
      been enforcing. No email provider is wired up yet, so invites
      surface as a copyable link in the UI rather than an actual email.
      Suspending or removing a staff member deletes their sessions outright
      (not just an app-layer block) so access is cut immediately. Guards:
      can't suspend/remove yourself, can't leave a company with zero
      active Owners. Verified end-to-end: a granted/denied permission
      takes effect on the affected staff member's very next request with
      no re-login required, a suspended staff member's next request lands
      on `/sign-in`, and cross-tenant staff access returns 404.
      Along the way, found and fixed a real infinite-redirect-loop bug:
      `proxy.ts` was bouncing "signed in" (cookie-present) visitors away
      from `/sign-in`, but a forcibly-revoked session leaves an orphaned
      cookie that looks present but isn't valid — `/dashboard`'s real
      session check would bounce back to `/sign-in`, which would bounce
      back to `/dashboard`, forever. Fixed by only using the middleware's
      cookie check to gate protected routes, never to redirect away from
      the sign-in page.
- [x] **Phase 5 — Branding/theming**: a `/settings/branding` page (primary/
      secondary color, logo URL, layout preset) writes to a per-company
      `BrandingSettings` row. The authenticated app shell reads it fresh on
      every render and injects `--brand-primary`/`--brand-secondary` as CSS
      custom properties, consumed via Tailwind's arbitrary-value syntax
      (`bg-[var(--brand-primary)]`) on primary actions and links across the
      app — scoped to the authenticated area only; the marketing/sign-in/
      invite pages stay neutrally branded since no company context exists
      yet there. `layoutPreset` (Default/Compact) is a real, if modest,
      structural difference (header/content padding), not just a cosmetic
      no-op. Verified end-to-end: a company's chosen color and logo render
      correctly (confirmed via computed styles, not just stored values),
      the Compact preset visibly reduces padding, and a second company with
      no branding configured shows neither the color nor the logo — no
      cross-tenant leakage.
- [x] **Phase 6 — Paystack billing**: `/api/webhooks/paystack` verifies
      Paystack's HMAC-SHA512 signature before trusting anything in the
      payload, and records every delivery in `PaystackEvent` keyed by a
      hash of the raw body so a retried delivery is a no-op instead of
      double-applying a state change. Routes that need a usable
      subscription (products, warehouses, branches, stock, transfers,
      sales, staff) live under a nested `(gated)` route group whose layout
      redirects to `/billing-required` when the subscription isn't active;
      `/dashboard` and `/settings/billing` stay reachable either way so a
      company can see what's wrong and fix it. `PAST_DUE` gets a 7-day
      grace period past the end of the last paid period before it gates;
      `CANCELLED` gates immediately. v1 bills through Paystack's
      Transactions API (verify-on-redirect, renew-by-webhook) rather than
      its Subscriptions API, which would need a saved card authorization
      for true auto-renewal — a deliberate scope trim, not an oversight,
      and a natural next step once there's a live Paystack account to
      build it against. No real Paystack account is configured in this
      dev environment, so checkout initiation surfaces a clear
      "billing is not configured" message rather than failing silently.
      Verified end-to-end (webhook payloads signed locally with the same
      HMAC scheme Paystack uses, since no live account is available):
      trial access works, `charge.success` activates a subscription,
      replaying the identical webhook payload is idempotent (checked via
      unchanged `processedAt`, not just a 200), an invalid signature is
      rejected before any DB write, `invoice.payment_failed` moves a
      subscription to `PAST_DUE`, the grace period is honored on both
      sides of its boundary, and `/dashboard`/`/settings/billing` remain
      reachable while every other route redirects to `/billing-required`.
- [x] **Phase 7 — Security & audit hardening**: the application connects at
      runtime as a separate, least-privilege Postgres role
      (`inventory_runtime`, `prisma/grants.sql`) rather than the schema
      owner — it structurally cannot `UPDATE`/`DELETE` the append-only
      `AuditLog`/`StockMovement` tables or touch `_prisma_migrations`,
      confirmed by actually attempting those statements as that role and
      watching Postgres reject them (`permission denied for table`), not
      just by reading the grant statements. Adds security headers (CSP,
      `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
      `Permissions-Policy`, HSTS) in `next.config.ts`, and an in-memory
      rate limiter (`src/lib/rate-limit.ts`) on staff invitations and
      sale/payment recording — documented as single-instance-only, with a
      shared store (Upstash Redis) as the noted upgrade for a
      multi-instance serverless deployment. Closed a real gap found during
      a Zod-coverage sweep of every Server Action (`startSubscriptionCheckout`
      was validating its input by hand instead of through a schema, unlike
      everywhere else). Added `scripts/reconcile-stock.ts`, which sums the
      `StockMovement` ledger per product/location and compares it against
      the cached `WarehouseStock`/`BranchStock` quantities — verified it
      actually catches drift by deliberately corrupting a cached value and
      confirming the script flagged it, not just that it passed on clean
      data. A consolidated cross-tenant IDOR sweep (one company builds one
      of every resource type; a second company attempts direct access to
      each by ID) confirmed 404 across products, warehouses, branches,
      transfers, sales, and staff, plus no leakage into any list view —
      formalizing the per-phase checks done throughout into one pass.
      **Deliberately deferred**, called out rather than silently skipped:
      Postgres Row-Level Security as a second independent enforcement
      layer beneath `getScopedPrisma` (a real architectural undertaking —
      wiring a `SET LOCAL` tenant context into every query path, not just
      transactional writes — layered on top of application-layer scoping
      that's already been verified clean across seven phases of IDOR
      testing, rather than the primary defense); `AuditLog` hash-chaining
      for tamper-evidence; a dependency-scanning CI pipeline (no CI is
      configured for this repo yet — `npm audit` currently reports zero
      vulnerabilities); and a dedicated accessibility audit (existing
      forms already use semantic `<label>`-wrapped inputs throughout, but
      this hasn't had a focused pass).
- [x] **Phase 8 — Customers & debt management**: a `Customer` model that
      Sales can optionally link to, so a business can see who owes them
      money across every invoice rather than only per-sale. Outstanding
      balance is deliberately never stored as a column — it's always
      derived fresh from `Sale.grandTotal - Sale.amountPaid` the same way
      the sale detail page already computed it (`customer-service.ts`),
      so a cached "debt" figure can never drift from the payment ledger
      that's the actual source of truth. Selecting an existing customer on
      the sale form snapshots their name/phone/email onto the `Sale` at
      the moment of sale (same philosophy as line-item price
      snapshotting), while still keeping the live `customerId` link for
      balance aggregation — editing a customer's phone number later never
      silently rewrites a historical invoice's displayed contact info. A
      sale can optionally carry a `dueDate` (credit-sale terms), which
      drives the "overdue" flag on the customers list and detail pages —
      the foundation a later automated-reminder feature would read from,
      not built yet. Two new permissions (`customers.view`,
      `customers.manage`) are enforced server-side on every page and
      Server Action, not just hidden buttons; granted by default to
      Owner/Admin/Branch Manager/Cashier (the roles that actually deal
      with customers) but not Warehouse Manager. Verified end-to-end: a
      credit sale linked to a customer correctly shows as overdue once its
      due date passes, a partial payment reduces both the sale's and the
      customer's aggregated outstanding balance correctly, a role without
      `customers.view` is blocked from the customers list and the
      new-customer page (both the UI message and, implicitly, every
      query behind it), and a second company cannot reach the first
      company's customer by ID guessing (404).
      **Deliberately out of scope for this phase**, left for a later one:
      supplier-side payables/expense management, automated debtor
      reminders (SMS/WhatsApp/email) once a balance goes overdue, and
      per-plan feature/seat limits — all raised as follow-on ideas but not
      requested to be built yet.
- [x] **Phase 9 — Expense management**: company-defined `ExpenseCategory`
      records (seven sensible defaults — Rent, Utilities, Salaries,
      Restocking & purchases, Transport & logistics, Marketing,
      Miscellaneous — seeded at onboarding the same way default Roles are,
      then freely renamed/archived/added-to per company) and the `Expense`
      records themselves, optionally scoped to one branch or left
      company-wide (head-office rent, for example). Like every other
      financial record in this app, an expense is never hard-deleted —
      correcting one is a documented void (`voidedByMembershipId`/
      `voidedAt`/`voidReason`), the same accountability pattern Phase 3
      established for voiding a Sale, so the expense ledger can't silently
      lose history the way a DELETE would. `isRecurring`/
      `recurrenceInterval` are a reporting label on this phase, not a
      scheduler — deliberately not auto-generating future expense rows,
      since nothing in this codebase runs a scheduled job yet (the same
      honest scope trim as `reconcile-stock.ts` staying on-demand rather
      than cron-driven). Two new permissions (`expenses.view`,
      `expenses.manage`), enforced server-side on every page and Server
      Action, granted by default to Owner/Admin/Branch Manager but not
      Warehouse Manager or Cashier — expense recording is a management
      concern, not a front-of-house one, unlike customer/debt tracking
      from Phase 8. Verified end-to-end: default categories are present
      immediately after sign-up, a company-wide and a branch-scoped
      expense both record and display correctly, the recurring label and
      interval show on the list, the "this month" total correctly sums
      only non-voided expenses (confirmed by voiding one and watching the
      total drop by exactly its amount rather than to zero), and a role
      without `expenses.view` is blocked from both the expenses list and
      the new-expense page.
      **Deliberately out of scope for this phase**: a combined profit/loss
      view joining Sale revenue against Expense costs (cheap to add now
      that both exist, but not asked for yet), receipt/attachment
      uploads, and multi-currency expenses (amounts are recorded in the
      company's single configured currency, same as Sales).
- [x] **Phase 10 — Tier-based plan limits**: `Plan.features`
      (`maxBranches`/`maxWarehouses`/`maxStaff`) existed since Phase 0 but
      was purely advertising — shown on the billing page, never actually
      enforced. `plan-limit-service.ts` closes that gap: `createBranch`,
      `createWarehouse`, and `inviteStaff` now each assert the company is
      under its plan's cap *before* creating anything, called from the
      Server Action itself rather than only hidden behind a disabled
      button — the same "never trust the UI alone" discipline this
      codebase has applied to permissions and subscription gating since
      Phase 0. A missing key in `features` means uncapped on that
      dimension, not zero, so a plan can leave any one of the three
      limits open-ended. Staff seats count `ACTIVE` memberships plus
      `PENDING` invitations — a pending invite already reserves a seat —
      deliberately *not* `Membership.status === "INVITED"`, which turned
      up as a real, if harmless, latent bug while building this: that
      status value is defined in the schema but never actually set
      anywhere in the invite flow (a Membership row isn't created until
      accept-time; the pending state lives on the `Invitation` row
      instead). The branches/warehouses/staff list pages now show a live
      "X of Y used" indicator with an upgrade link once a company hits a
      cap, so the limit is visible before someone hits a wall, not only
      as an error message after. Verified end-to-end by temporarily
      tightening a live plan's limits: the first branch/warehouse/staff
      seat under a cap succeeds and the usage indicator updates, the next
      one is rejected server-side with a clear message and no record is
      created, and restoring the plan's real limits afterward confirmed
      Growth/Starter both still read correctly.
      **Deliberately out of scope**: self-serve plan upgrades that
      auto-relax a limit mid-session (a company already over a new,
      lower limit after a downgrade isn't force-corrected — existing
      resources stay as-is, only new creation is blocked), and per-feature
      (rather than per-count) gating, e.g. a tier that hides branding
      customization entirely rather than capping a number.
- [x] **Phase 11 — Automated debtor reminders**: SMS reminders for
      customers with an overdue balance, off by default per company
      (`Company.debtReminderEnabled`/`debtReminderDaysOverdue`) and
      further opt-out-able per customer (`Customer.remindersEnabled`) —
      both must be true for a message to send, so turning the feature on
      never silently starts messaging a customer who was never asked.
      `debt-reminder-service.ts` finds every customer with a non-voided
      sale whose `dueDate` is past the company's threshold and an
      outstanding balance, skips anyone reminded within the last 3 days
      regardless of the company's threshold (so a 1-day setting can't spam
      daily), and — via `sms-client.ts`, a thin wrapper around Termii
      structured exactly like `paystack/client.ts`'s "not configured"
      pattern from Phase 6 — sends and records every attempt as an
      append-only `DebtReminder` row (status `SENT`/`FAILED`, the exact
      message, the provider response or error), the same accountability
      pattern as `AuditLog`/`StockMovement`; `prisma/grants.sql` now
      revokes `UPDATE`/`DELETE` on it too. Two trigger paths share the
      same service: `vercel.json` schedules `/api/cron/debt-reminders`
      daily (a plain Route Handler, not a Server Action, protected by a
      `CRON_SECRET` bearer token since Vercel's scheduler isn't a signed-in
      browser — this is the first thing in the app with real scheduled
      automation, closing the gap Phase 9 explicitly deferred), and a
      "Send reminders now" button on the customers page lets staff with
      `customers.manage` trigger the same logic on demand, rate-limited
      the same way other cost-bearing actions are. Verified end-to-end
      without a real Termii account (none is configured in this dev
      environment, matching how Phase 6 tested Paystack): the cron route
      correctly 401s with no/wrong secret and 200s with the right one;
      with only a placeholder key it finds candidates but sends nothing
      and writes no `DebtReminder` rows (a real config problem, not a
      per-message failure, so nothing is logged as attempted); swapping in
      a real-shaped-but-invalid key drives the actual send path and
      confirms a `FAILED` row and audit entry get written with Termii's
      rejection reason even when Termii's response isn't valid JSON;
      re-running immediately after finds zero candidates, confirming the
      3-day cooldown; and — most directly — a company with two overdue
      customers, one opted out, reports exactly one candidate, not two,
      proving the opt-out filter runs at the query level rather than being
      a UI-only checkbox. Also fixed a real bug found while building this:
      the settings form's "enabled" checkbox used React-controlled state
      that silently fell out of sync with the just-saved value after the
      page's server data refreshed (the save itself was always correct,
      confirmed via direct DB inspection — this was a display-only bug);
      switched it to an uncontrolled input, since nothing else in the form
      needed to react to that value live.
      **Deliberately out of scope**: WhatsApp/email channels (the
      `DebtReminderChannel` enum only has `SMS` today, but the schema and
      service are structured to add one without reshaping either), and a
      full receivables-collections workflow (payment plans, escalating
      message tiers by days overdue) beyond a single reminder message.
- [x] **Phase 12 — Mobile app foundation**: an Expo (React Native +
      TypeScript, Expo Router) companion app in `mobile/`, for
      already-onboarded staff to record sales, take payments, check
      stock, and manage customers/debt from a phone. It's a second
      client for the same backend, not a second implementation of it —
      a new JSON API layer under `src/app/api/mobile/v1/*` calls the
      exact same `server/services/*` functions, `requirePermission`
      checks, and `getScopedPrisma` tenant isolation every web Server
      Action already uses, through a thin HTTP-status-mapping wrapper
      (`lib/api/mobile-auth.ts`) rather than a parallel authorization
      system. Mobile auth runs through `@better-auth/expo` (the
      `expo()`/`bearer()` plugins added to `better-auth.ts` specifically
      for this): React Native has no browser cookie jar, so the Expo
      client emulates one on `expo-secure-store`, and the mobile app
      reads it back out to authenticate its own API calls — the same
      DB-backed session every other client uses, so suspending a staff
      member or revoking a permission takes effect on their phone's next
      request exactly like it does in a browser. Upgrading `better-auth`
      to the version `@better-auth/expo` requires (^1.7.1, from ^1.6.28)
      turned up a real, if narrow, breaking change: the `Account` table
      gained a required `issuer` column with a new
      `[issuer, accountId]` unique index — missed at first (a 500 on
      sign-up), traced to the exact new-field diff in Better Auth's own
      schema source, and fixed with a proper migration rather than
      papering over it.
      **Verified without a device** (this sandbox has no iOS/Android
      simulator): `npx expo export` successfully bundles the entire app
      (1700+ modules) into real Hermes bytecode for both iOS and Android
      with zero errors, which catches the large majority of real
      breakage short of an actual render; every `/api/mobile/v1/*`
      endpoint was exercised directly with a real bearer token —
      sign-up, sign-in, `/me` resolving correct permissions and
      subscription status, creating a sale and recording a partial
      payment (with the exact same overpayment-rejection message the
      web app produces, confirming it's the same service code path, not
      a reimplementation), and creating a customer; and a second
      company's bearer token was confirmed unable to read the first
      company's sale or customer (404, no data in list views) — the same
      cross-tenant isolation guarantee every other phase has verified,
      now proven for this API layer too. Also had to fix the root
      `tsconfig.json`/`eslint.config.mjs` to exclude `mobile/`, a
      separate TypeScript project with its own tsconfig and globals that
      was otherwise getting swept into the Next.js app's typecheck and
      corrupting unrelated type resolution.
      **Deliberately out of scope for this phase**: company sign-up and
      onboarding on mobile (an Owner is expected to do initial setup —
      creating the company, adding branches/products, inviting staff —
      on the web, same as every company has so far), and mobile CRUD for
      products/warehouses/branches, stock transfers, staff, billing,
      branding, and expenses — all still web-only for now, staged for
      later phases the same way the web app itself was staged.
- [x] **Phase 13 — Credit notes + printing**: a new `CreditNote` document
      type (`credit-note-service.ts`) — sequential `CN-NNNNNN` numbering via
      the same atomic-counter pattern as `Sale.saleNumber`, void-not-delete
      accountability — that reduces a sale's outstanding balance
      (`grandTotal - amountPaid - creditedTotal`) without touching stock or
      the sale record itself, capped at the currently-outstanding amount
      the same overcorrection guard `recordPayment()` applies in the
      opposite direction. `customer-service.ts` and
      `debt-reminder-service.ts` both now subtract credited amounts before
      computing a customer's outstanding balance, so a credited sale
      correctly drops out of the debtor-reminder pipeline instead of still
      being chased for money that's been written off. Two new permissions
      (`credit_notes.issue`, `credit_notes.void`), granted by default to
      Owner/Admin only — same precedent as `sales.void`. On the web,
      printing is plain `window.print()` gated by Tailwind's `print:`
      variant (the app chrome disappears, the invoice/credit-note stays) —
      works with any printer already paired at the OS level, no Bluetooth
      needed there. On mobile, printing means an actual 58mm/80mm Bluetooth
      thermal receipt printer: a pure ESC/POS command-builder
      (`mobile/lib/escpos.ts`, no native dependency) plus a BLE transport
      (`mobile/lib/bluetooth-printer.ts`, via `react-native-ble-plx`) that
      scans, lets the user pick their printer from a list (there's no
      single UUID standard across printer vendors, so this is scan-and-pick
      rather than a hardcoded service UUID), discovers the first writable
      characteristic, and writes ESC/POS bytes to it in MTU-safe chunks —
      the same pairing pattern real-world ESC/POS-over-BLE printer
      integrations use. This is the first native module in the mobile app,
      so it moves from Expo Go to a Development Build
      (`expo run:android`/`expo run:ios`, via the `react-native-ble-plx`
      config plugin) for anything touching printing; every other screen
      still runs fine in plain Expo Go. Verified end-to-end on web
      (Playwright): issuing a partial credit note correctly reduces
      outstanding, over-crediting past the outstanding balance is rejected,
      a customer's aggregated debt reflects credit notes issued against
      their sales, both the invoice and credit-note print views render
      correctly, and voiding a credit note correctly reverts the sale's
      outstanding balance back to its pre-credit amount — the last check
      surfaced a genuine Playwright pitfall worth noting: `textContent()`
      on the page body picked up literal JSON text left over in an inert
      `<script>` tag (Next.js's streaming-SSR hydration payload from a
      full-page load moments earlier, never removed from the DOM), making
      a *correctly reverted* page look stale; switching the assertion to
      `innerText` (rendered text only, excludes script tags) fixed it —
      confirmed via an isolated reproduction that the underlying
      issue/void logic was correct throughout, this was purely a
      test-script artifact. **Verified without hardware** on mobile (this
      sandbox has no Bluetooth radio or physical printer): `npx expo
      export` bundles cleanly with the new native dependency, `npx expo
      prebuild --platform android` confirms the config plugin correctly
      writes the Android manifest permissions
      (`BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN` with `neverForLocation`, so no
      location permission is needed on Android 12+), and the ESC/POS byte
      encoder was checked against the actual command bytes with plain
      Node — but real pairing and printing on a physical printer has not
      been done and needs a human with real hardware to confirm. See
      `mobile/README.md` for the full verification breakdown.

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL 16 database

### Setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and BETTER_AUTH_SECRET
npx prisma migrate dev
npm run db:seed        # seeds the permission catalog and subscription plans
npm run dev
```

Generate a `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.

### Least-privilege runtime role

The app is designed to connect at runtime as a role separate from the one
that owns the schema and runs migrations, so a bug or a leaked runtime
credential can't rewrite the append-only audit trail (see Phase 7 above).
Set this up once per environment, after running migrations:

```bash
psql "$DATABASE_URL" -c "CREATE ROLE inventory_runtime WITH LOGIN PASSWORD '<generate a real secret>';"
npm run db:grants
```

Then set `RUNTIME_DATABASE_URL` in `.env` to that role's connection string.
This step is optional for a quick local try (the app falls back to
`DATABASE_URL` if `RUNTIME_DATABASE_URL` is unset) but should never be
skipped in a real deployment.

### Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build & run
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run prisma:migrate` — run a new Prisma migration
- `npm run db:seed` — re-run the seed script (idempotent — safe to re-run)
- `npm run db:grants` — apply `prisma/grants.sql` (see above)
- `npm run reconcile:stock` — verify the `StockMovement` ledger still
  agrees with cached `WarehouseStock`/`BranchStock` quantities; exits
  non-zero and prints details on any mismatch

## Architecture notes

- **Tenant isolation**: all application code reading/writing tenant-scoped tables (see
  `TENANT_SCOPED_MODELS` in `src/lib/db/scoped-prisma.ts`) must go through
  `getScopedPrisma(companyId)`, which auto-injects `companyId` into every query via a Prisma
  Client Extension. The raw `prisma` singleton is reserved for platform-level code where no
  `companyId` scope exists yet (onboarding, webhooks resolving a company by external ID).
- **Authorization**: never trust the client. Every privileged Server Action / Route Handler
  calls `requirePermission()` (`src/lib/auth/session.ts`), which recomputes the caller's
  effective permission set from the database on every call — role permissions plus
  per-staff `GRANT`/`DENY` overrides, DENY always winning. `src/proxy.ts` (Next.js's
  middleware convention) only does a cheap session-cookie presence check for routing/UX; it
  is never the authorization boundary.
- **Audit logging**: `AuditLog` is append-only and written for every sensitive mutation via
  `writeAuditLog()` (`src/server/services/audit-service.ts`), ideally inside the same DB
  transaction as the mutation it records.
- **Defense in depth at the database**: even with `getScopedPrisma` and `requirePermission`
  both enforced correctly, the app's own DB credential (`RUNTIME_DATABASE_URL`) cannot
  `UPDATE`/`DELETE` `AuditLog`, `StockMovement`, or `DebtReminder` — see `prisma/grants.sql`.
  This is a second, independent layer: a bug in application code hits a Postgres permission
  error, not a successfully rewritten audit trail.
- **Rate limiting**: `src/lib/rate-limit.ts` is an in-memory limiter applied to staff
  invitations, sale/payment recording, and on-demand debt-reminder sends, on top of Better
  Auth's own built-in rate limiting on `/api/auth/*`. It's correct for a single Node.js process; a multi-instance serverless
  deployment needs a shared store (Upstash Redis) behind the same `checkRateLimit()` interface.
