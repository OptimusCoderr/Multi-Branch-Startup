"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { AcceptInvitationButton } from "./accept-invitation-button";

export function InviteAuthForm({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: authError } =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email: invitedEmail, password })
        : await authClient.signIn.email({ email: invitedEmail, password });

    if (authError) {
      setError(authError.message ?? "Authentication failed.");
      setIsSubmitting(false);
      return;
    }

    // Accepting the invitation happens through a real <form action> bound
    // to the Server Action (AcceptInvitationButton) rather than calling it
    // as a bare function here — a Server Action that calls redirect() is
    // not reliably invokable as a plain async function from a client event
    // handler (see the sign-up flow for the same lesson learned).
    setAuthenticated(true);
  }

  if (authenticated) {
    return <AcceptInvitationButton token={token} email={invitedEmail} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className={`rounded-md px-3 py-1.5 ${mode === "sign-up" ? "bg-black text-white" : "border border-gray-300 text-gray-700"}`}
        >
          I&apos;m new here
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className={`rounded-md px-3 py-1.5 ${mode === "sign-in" ? "bg-black text-white" : "border border-gray-300 text-gray-700"}`}
        >
          I already have an account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input value={invitedEmail} disabled className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500" />
        </label>

        {mode === "sign-up" && (
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input
              className="rounded-md border border-gray-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="rounded-md border border-gray-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "sign-up" ? 10 : undefined}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "Continuing…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
