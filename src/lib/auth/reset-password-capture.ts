import { AsyncLocalStorage } from "node:async_hooks";

/**
 * No email provider is configured (same situation staff invites already
 * handle — see inviteStaff()), so Better Auth's forgetPassword() can't
 * actually send the reset link anywhere. Instead, better-auth.ts's
 * `sendResetPassword` callback captures the generated URL here, and the
 * admin Server Action that triggered forgetPassword() reads it back out
 * immediately after — the link is handed to a support agent to share with
 * the locked-out user directly, the same "no email provider, share the
 * link yourself" pattern as staff invites.
 *
 * Deliberately NOT `import "server-only"` — better-auth.ts (which this
 * feeds into) is imported by plain tsx scripts outside Next's build
 * pipeline (scripts/create-platform-admin.ts, prisma/seed.ts), and
 * `server-only` only resolves inside Next's own bundler, not under plain
 * Node — it doesn't even exist as an installed package. Anything that
 * chain depends on has to stay importable there.
 *
 * AsyncLocalStorage rather than a plain module-level variable: forgetPassword()
 * awaits sendResetPassword() inline (Better Auth's runInBackgroundOrAwait,
 * with no background-task handler configured, just awaits it), so the
 * callback runs within the same async call chain as the action that
 * triggered it — but a module-level variable would still be a shared,
 * racy target under concurrent requests in the same Node process. Each
 * captureResetPasswordUrl() call gets its own isolated store instead.
 */
const storage = new AsyncLocalStorage<{ url?: string }>();

export async function captureResetPasswordUrl(fn: () => Promise<void>): Promise<string | null> {
  const box: { url?: string } = {};
  await storage.run(box, fn);
  return box.url ?? null;
}

export function recordResetPasswordUrl(url: string): void {
  const box = storage.getStore();
  if (box) box.url = url;
}
