import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// The application connects at runtime as a separate, least-privilege
// Postgres role from the one that owns the schema and runs migrations
// (DATABASE_URL) — see the REVOKE statements in the Phase 7 migration.
// Falls back to DATABASE_URL so local setups that haven't created the
// runtime role yet still work; production should always set this.
const datasourceUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;

// Standard Next.js dev-mode-hot-reload-safe singleton: without this, every
// hot reload would open a new pool of Postgres connections until they're
// exhausted.
export const prisma = globalThis.__prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
