import { betterAuth } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";
import { recordResetPasswordUrl } from "@/lib/auth/reset-password-capture";

// The mobile app's custom URL scheme, for deep-linking back after
// browser-based auth flows (magic links, OAuth) and for the expo()
// plugin's origin allow-list — see mobile/app.json's "scheme".
const MOBILE_APP_SCHEME = "multibranchinventory://";

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
