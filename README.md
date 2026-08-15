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
  `UPDATE`/`DELETE` `AuditLog` or `StockMovement` — see `prisma/grants.sql`. This is a second,
  independent layer: a bug in application code hits a Postgres permission error, not a
  successfully rewritten audit trail.
- **Rate limiting**: `src/lib/rate-limit.ts` is an in-memory limiter applied to staff
  invitations and sale/payment recording, on top of Better Auth's own built-in rate limiting
  on `/api/auth/*`. It's correct for a single Node.js process; a multi-instance serverless
  deployment needs a shared store (Upstash Redis) behind the same `checkRateLimit()` interface.
