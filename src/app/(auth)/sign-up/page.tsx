"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { AuthThemeShell, useAuthTheme } from "@/components/auth/auth-theme";
import { CompanyStepForm } from "./company-step-form";
import { JoinCompanyStepForm } from "./join-company-step-form";

type SignUpRole = "owner" | "staff";

function RoleChoiceStep({ onChoose }: { onChoose: (role: SignUpRole) => void }) {
  const { accent } = useAuthTheme();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Are you setting up a new company, or joining one your employer already created?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onChoose("owner")}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-left transition-shadow hover:ring-2"
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        >
          <span className="block font-semibold">I&apos;m the business owner</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">Start a 14-day trial and set up your company.</span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("staff")}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-left transition-shadow hover:ring-2"
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        >
          <span className="block font-semibold">I&apos;m joining as staff</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">Use your company&apos;s code to request access.</span>
        </button>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold underline" style={{ color: accent }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

function SignUpFormStep({
  role,
  onBack,
  onSubmit,
}: {
  role: SignUpRole;
  onBack: () => void;
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
        <button type="button" onClick={onBack} className="mb-2 text-sm text-gray-500 dark:text-gray-400 underline">
          ← Back
        </button>
        <h1 className="font-display text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {role === "owner" ? "Start a 14-day trial — no card required." : "Next, you'll enter your company's join code."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
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
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
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
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
            style={{ "--tw-ring-color": accent } as React.CSSProperties}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ background: "var(--accent-gradient)" }}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold underline" style={{ color: accent }}>
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignUpPage() {
  const [step, setStep] = useState<"role" | "account" | "company" | "join">("role");
  const [role, setRole] = useState<SignUpRole>("owner");
  const [email, setEmail] = useState("");

  function handleRoleChoice(chosenRole: SignUpRole) {
    setRole(chosenRole);
    setStep("account");
  }

  async function handleAccountSubmit(input: { name: string; email: string; password: string }): Promise<string | null> {
    const { error: signUpError } = await authClient.signUp.email(input);
    if (signUpError) {
      return signUpError.message ?? "Could not create your account.";
    }

    setEmail(input.email);
    // Move to the company/join step. Those forms post through a real
    // <form action={...}> bound to a Server Action, which is the pattern
    // Next.js's action runtime handles reliably when the action calls
    // redirect() — calling a redirecting Server Action as a bare function
    // from an event handler is not a supported pattern.
    setStep(role === "owner" ? "company" : "join");
    return null;
  }

  return (
    <AuthThemeShell>
      {step === "role" && <RoleChoiceStep onChoose={handleRoleChoice} />}

      {step === "account" && (
        <div className="flex flex-col gap-6">
          <SignUpFormStep role={role} onBack={() => setStep("role")} onSubmit={handleAccountSubmit} />
        </div>
      )}

      {step === "company" && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">Create your company</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">One more step — no card required for your 14-day trial.</p>
          </div>
          <CompanyStepForm email={email} />
        </div>
      )}

      {step === "join" && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">Join your company</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Last step — enter the code your employer shared with you.</p>
          </div>
          <JoinCompanyStepForm email={email} />
        </div>
      )}
    </AuthThemeShell>
  );
}
