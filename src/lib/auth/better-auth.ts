import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // flip on once an email provider is wired up (Phase 4+)
    minPasswordLength: 10,
  },
  session: {
    // Server-side (DB-backed) sessions, not stateless JWTs, so an admin
    // suspending a staff member or revoking a permission can force that
    // staff member's session out on their very next request.
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
});

export type Session = typeof auth.$Infer.Session;
