import { betterAuth } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { expo } from "@better-auth/expo";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";
import { recordResetPasswordUrl } from "@/lib/auth/reset-password-capture";

// The mobile app's custom URL scheme, for deep-linking back after
// browser-based auth flows (magic links, OAuth) and for the expo()
// plugin's origin allow-list — see mobile/app.json's "scheme".
const MOBILE_APP_SCHEME = "multibranchinventory://";

// Per-account lockout layered on top of the rateLimit config below — an
// IP-based limit alone doesn't stop a botnet spreading password guesses
// against ONE account across many IPs (a credential-stuffing attack),
// since each individual IP stays well under the per-IP threshold. 5
// wrong passwords locks the account for 15 minutes; both numbers are
// named here rather than left as magic numbers scattered through the
// hooks below.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// A nonexistent email short-circuits before Better Auth ever hashes a
// password, so it can return measurably faster than a real email with a
// wrong password — a user-enumeration timing tell. This fixed delay is a
// rough approximation of that hashing cost, not a precise guarantee (real
// constant-time defense would mean hooking into Better Auth's own scrypt
// verification, which isn't exposed to a `hooks.before`); it costs
// nothing on the success/failure path since it only ever runs for an
// email that isn't in the system at all.
const NONEXISTENT_USER_DELAY_MS = 200;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [MOBILE_APP_SCHEME],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // flip on once an email provider is wired up (Phase 4+)
    minPasswordLength: 10,
    // No email provider configured — same situation as staff invites. The
    // link is captured here instead of sent, for a support agent's
    // "generate a reset link" tool (src/server/actions/platform-admin.ts)
    // to hand directly to a locked-out user.
    sendResetPassword: async ({ url }) => {
      recordResetPasswordUrl(url);
    },
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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;

      const user = await prisma.user.findUnique({ where: { email }, select: { lockedUntil: true } });

      if (user?.lockedUntil && user.lockedUntil > new Date()) {
        // Identical message a wrong password gets — a locked account
        // must not be distinguishable from a mistyped password.
        throw new APIError("UNAUTHORIZED", { message: "Invalid email or password" });
      }
      if (!user) {
        await delay(NONEXISTENT_USER_DELAY_MS);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;

      // A locked account never reaches here — the `before` hook above
      // throws for it, which aborts the dispatch before `after` hooks
      // run, so there's no risk of double-counting/re-locking an
      // already-locked account.
      const failed = ctx.context.returned instanceof APIError;

      if (failed) {
        const updated = await prisma.user.updateMany({ where: { email }, data: { failedLoginAttempts: { increment: 1 } } });
        if (updated.count === 0) return; // nonexistent email — nothing to count

        const user = await prisma.user.findUnique({ where: { email }, select: { id: true, failedLoginAttempts: true } });
        if (user && user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
          });
        }
      } else {
        await prisma.user.updateMany({ where: { email }, data: { failedLoginAttempts: 0, lockedUntil: null } });
      }
    }),
  },
  plugins: [
    // React Native has no browser-style cookie jar, so the mobile app
    // authenticates with `Authorization: Bearer <token>` instead of a
    // session cookie — bearer() resolves that into the same session
    // getSession()/requireMembership() already use everywhere else, so
    // every existing permission/tenant check works unmodified for mobile
    // requests too. expo() handles the mobile app's custom-scheme origin
    // and deep-link callback plumbing around it.
    bearer(),
    expo(),
    // TOTP + backup codes only — the "otp" method (email/SMS one-time
    // codes) needs a real send implementation we don't have (same gap as
    // sendResetPassword above), so the UI never offers it and this plugin
    // is left on its defaults for that method. Mandatory for company
    // Owners and platform staff, optional for everyone else — enforced by
    // requireMembershipWithTwoFactor()/requirePlatformStaffWithTwoFactor()
    // in src/lib/auth/session.ts, not by this plugin (it has no concept of
    // roles).
    twoFactor({
      issuer: "Multi-Branch Inventory",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
