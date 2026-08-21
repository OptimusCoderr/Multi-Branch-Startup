"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { AuthThemeShell, useAuthTheme } from "@/components/auth/auth-theme";

function TwoFactorForm() {
  const router = useRouter();
  const { accent } = useAuthTheme();
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: verifyError } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });

    if (verifyError) {
      setError(verifyError.message ?? "That code didn't work.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Verify it&apos;s you</h1>
        <p className="mt-1 text-sm text-gray-500">
          {useBackupCode
            ? "Enter one of your backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {useBackupCode ? "Backup code" : "Authentication code"}
          <input
            type="text"
            inputMode={useBackupCode ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            maxLength={useBackupCode ? 16 : 6}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-shadow focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": accent } as React.CSSProperties}
            value={code}
            onChange={(e) => setCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ""))}
            required
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
          Trust this device for 30 days
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ background: "var(--accent-gradient)" }}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <button
        type="button"
        className="mt-6 text-center text-sm font-semibold underline"
        style={{ color: accent }}
        onClick={() => {
          setUseBackupCode((v) => !v);
          setCode("");
          setError(null);
        }}
      >
        {useBackupCode ? "Use your authenticator app instead" : "Use a backup code instead"}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        <Link href="/sign-in" className="underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function TwoFactorPage() {
  return (
    <AuthThemeShell>
      <TwoFactorForm />
    </AuthThemeShell>
  );
}
