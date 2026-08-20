-- Least-privilege runtime role — grants only.
--
-- Deliberately NOT a Prisma migration: `prisma migrate dev` validates every
-- migration against a throwaway shadow database, and GRANT/REVOKE
-- statements referencing an external role don't play well with that flow
-- (and CREATE ROLE requires CREATEROLE/superuser, which the migration role
-- typically doesn't have on managed Postgres like Neon/RDS/Supabase — role
-- creation there is an admin/dashboard operation, not something app
-- migrations should assume). This script is applied once per environment,
-- after `prisma migrate deploy`, via `npm run db:grants` — see README.md.
--
-- The application connects at runtime as a *different* Postgres role from
-- the one that owns the schema and runs migrations (whatever DATABASE_URL
-- points to). This role cannot UPDATE, DELETE, or TRUNCATE the append-only
-- AuditLog / StockMovement / DebtReminder tables, cannot DELETE
-- PaystackEvent rows, and has no access at all to _prisma_migrations or
-- any DDL — so a bug in application code, or a leaked runtime credential,
-- structurally cannot rewrite audit history or run schema migrations.
--
-- Prerequisite: the role must already exist —
--   CREATE ROLE inventory_runtime WITH LOGIN PASSWORD '<a real generated secret>';
-- This script fails loudly if it doesn't, rather than silently no-op-ing.

GRANT USAGE ON SCHEMA public TO inventory_runtime;

-- Default: full DML on ordinary tables (no DDL, no TRUNCATE).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO inventory_runtime;

-- Append-only tables: the app may only ever add rows, never rewrite or
-- erase history, even via a bug or a compromised runtime credential.
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM inventory_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "StockMovement" FROM inventory_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "DebtReminder" FROM inventory_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "PlatformAuditLog" FROM inventory_runtime;

-- PaystackEvent legitimately needs UPDATE (RECEIVED -> PROCESSED/FAILED)
-- but should never be deleted — it's the webhook audit trail.
REVOKE DELETE, TRUNCATE ON "PaystackEvent" FROM inventory_runtime;

-- Migration bookkeeping is a schema-owner concern, not a runtime one.
REVOKE ALL ON "_prisma_migrations" FROM inventory_runtime;

-- Future tables created by later migrations (run as the owner role)
-- inherit the same sane default — full DML, no DDL/TRUNCATE — without
-- needing to remember this step every time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO inventory_runtime;
