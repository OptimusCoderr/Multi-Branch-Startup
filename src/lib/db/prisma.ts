import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Standard Next.js dev-mode-hot-reload-safe singleton: without this, every
// hot reload would open a new pool of Postgres connections until they're
// exhausted.
export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
