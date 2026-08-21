"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { AuthThemeShell, useAuthTheme } from "@/components/auth/auth-theme";
import { CompanyStepForm } from "./company-step-form";

function SignUpFormStep({
  onSubmit,
}: {
  onSubmit: (input: { name: string; email: string; password: string }) => Promise<string | null>;
}) {
  const { accent } = useAuthTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const submitError = await onSubmit({ name, email, password });
    setError(submitError);
    setIsSubmitting(false);
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">Start a 14-day trial — no card required.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": accent } as React.CSSProperties}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Work email
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
            minLength={10}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ backgroundColor: accent }}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold underline" style={{ color: accent }}>
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignUpPage() {
  const [step, setStep] = useState<"account" | "company">("account");
  const [email, setEmail] = useState("");

  async function handleAccountSubmit(input: { name: string; email: string; password: string }): Promise<string | null> {
    const { error: signUpError } = await authClient.signUp.email(input);
    if (signUpError) {
      return signUpError.message ?? "Could not create your account.";
    }

    setEmail(input.email);
    // Move to the company-creation step. That form posts through a real
    // <form action={...}> bound to the Server Action, which is the pattern
    // Next.js's action runtime handles reliably when the action calls
    // redirect() — calling a redirecting Server Action as a bare function
    // from an event handler is not a supported pattern.
    setStep("company");
    return null;
  }

  return (
    <AuthThemeShell>
      {step === "company" ? (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">Create your company</h1>
            <p className="mt-1 text-sm text-gray-500">One more step — no card required for your 14-day trial.</p>
          </div>
          <CompanyStepForm email={email} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <SignUpFormStep onSubmit={handleAccountSubmit} />
        </div>
      )}
    </AuthThemeShell>
  );
}
