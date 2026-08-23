"use client";

import { authClient } from "@/lib/auth/auth-client";

/**
 * The final steps of sign-up (naming a company / entering a join code)
 * have no earlier step to go "back" to — the account is already created
 * by then, so undoing that isn't what a back button would even mean. What
 * a stuck user actually needs is an explicit way out: sign out and land
 * back on the role-choice step, rather than the browser back button
 * (which would just navigate away from a signed-in account with no clean
 * state to land on).
 *
 * A full reload (not next/navigation's router) is deliberate: the whole
 * multi-step wizard lives at the single /sign-up URL with the step held in
 * local component state, never in the URL — a client-side router.push to
 * the page it's already on is a same-route no-op that leaves that state
 * (and the stale session data react-query/SWR may hold) untouched.
 */
export function SignOutAndRestartLink() {
  async function handleClick() {
    await authClient.signOut();
    window.location.assign("/sign-up");
  }

  return (
    <button type="button" onClick={handleClick} className="text-center text-sm text-gray-500 dark:text-gray-400 underline">
      Not you? Sign out and start over
    </button>
  );
}
