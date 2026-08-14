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
- [ ] Phase 1 — Products, Warehouses, Branches catalog
- [ ] Phase 2 — Stock transfers with accountability (request/approve/dispatch/receive)
- [ ] Phase 3 — Sales & partial/installment payments
- [ ] Phase 4 — Staff invitations & per-staff permission overrides UI
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
