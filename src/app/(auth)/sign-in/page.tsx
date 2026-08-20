"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { AuthThemeShell, useAuthTheme } from "@/components/auth/auth-theme";

function SignInForm() {
  const router = useRouter();
  const { accent } = useAuthTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await authClient.signIn.email({ email, password });

    if (signInError) {
      setError(signInError.message ?? "Could not sign in.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": accent } as React.CSSProperties}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": accent } as React.CSSProperties}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ backgroundColor: accent }}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-semibold underline" style={{ color: accent }}>
          Create one
        </Link>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <AuthThemeShell>
      <SignInForm />
    </AuthThemeShell>
  );
}
