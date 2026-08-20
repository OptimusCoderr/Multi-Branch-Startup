"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { AuthThemeShell, useAuthTheme } from "@/components/auth/auth-theme";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");
  const { accent } = useAuthTheme();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (tokenError || !token) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Link expired or invalid</h1>
        <p className="mt-2 text-sm text-gray-500">
          This password reset link is no longer valid. Ask whoever helped you (a support agent, or your company&apos;s
          Owner/Admin) to generate a new one.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-gray-500">You can sign in with your new password now.</p>
        <Link
          href="/sign-in"
          className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token: token! });
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError.message ?? "Could not reset your password. The link may have expired.");
      return;
    }

    setDone(true);
    router.refresh();
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            type="password"
            className="rounded-md border border-gray-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Confirm new password
          <input
            type="password"
            className="rounded-md border border-gray-300 px-3 py-2"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={10}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ backgroundColor: accent }}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthThemeShell>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthThemeShell>
  );
}
