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
- [ ] Phase 5 — Branding/theming
- [ ] Phase 6 — Paystack subscription billing
- [ ] Phase 7 — Security & audit hardening (rate limiting, Postgres RLS, IDOR sweep)

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

### Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build & run
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run prisma:migrate` — run a new Prisma migration
- `npm run db:seed` — re-run the seed script (idempotent — safe to re-run)

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
