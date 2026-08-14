"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { CompanyStepForm } from "./company-step-form";

export default function SignUpPage() {
  const [step, setStep] = useState<"account" | "company">("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signUpError } = await authClient.signUp.email({ name, email, password });

    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account.");
      setIsSubmitting(false);
      return;
    }

    // Move to the company-creation step. That form posts through a real
    // <form action={...}> bound to the Server Action, which is the pattern
    // Next.js's action runtime handles reliably when the action calls
    // redirect() — calling a redirecting Server Action as a bare function
    // from an event handler is not a supported pattern.
    setStep("company");
    setIsSubmitting(false);
  }

  if (step === "company") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
        <div>
          <h1 className="text-2xl font-semibold">Create your company</h1>
          <p className="mt-1 text-sm text-gray-500">One more step — no card required for your 14-day trial.</p>
        </div>
        <CompanyStepForm email={email} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">Start a 14-day trial — no card required.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <label className="flex flex-col gap-1 text-sm">
          Work email
          <input
            type="email"
            className="rounded-md border border-gray-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="rounded-md border border-gray-300 px-3 py-2"
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
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-black underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
