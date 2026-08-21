"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldAlert, Copy, Check } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";

type Variant = "light" | "dark";

const STYLES: Record<Variant, Record<string, string>> = {
  light: {
    card: "rounded-lg border border-gray-200 bg-white p-5",
    heading: "text-gray-900",
    muted: "text-gray-500",
    input: "rounded-md border border-gray-300 px-3 py-2 text-gray-900",
    primaryButton: "rounded-md bg-[var(--brand-primary,#4f46e5)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
    secondaryButton: "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50",
    dangerButton: "rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50",
    codeBox: "rounded-md bg-gray-50 border border-gray-200 p-3 font-mono text-sm text-gray-800",
    error: "text-sm text-red-600",
  },
  dark: {
    card: "rounded-lg border border-gray-800 bg-gray-900 p-5",
    heading: "text-gray-100",
    muted: "text-gray-400",
    input: "rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-gray-100",
    primaryButton: "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
    secondaryButton: "rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 disabled:opacity-50",
    dangerButton: "rounded-md border border-red-800 px-4 py-2 text-sm font-medium text-red-400 disabled:opacity-50",
    codeBox: "rounded-md bg-gray-950 border border-gray-800 p-3 font-mono text-sm text-gray-200",
    error: "text-sm text-red-400",
  },
};

export function TwoFactorSecurityPanel({
  initialEnabled,
  mandatory,
  variant = "light",
}: {
  initialEnabled: boolean;
  mandatory: boolean;
  variant?: Variant;
}) {
  const router = useRouter();
  const s = STYLES[variant];

  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enrollment (only reachable while !enabled)
  const [enrollStep, setEnrollStep] = useState<"start" | "confirm">("start");
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [codesCopied, setCodesCopied] = useState(false);

  // Regenerate backup codes (only reachable while enabled)
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);

  // Disable (only reachable while enabled and !mandatory)
  const [isDisabling, setIsDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const secret = totpURI ? new URL(totpURI).searchParams.get("secret") : null;

  async function handleStartEnrollment(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { data, error: enableError } = await authClient.twoFactor.enable({ password, method: "totp" });
    setIsSubmitting(false);
    if (enableError) {
      setError(enableError.message ?? "Could not start two-factor setup.");
      return;
    }
    if (data && "totpURI" in data) {
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes);
      setEnrollStep("confirm");
    }
  }

  async function handleConfirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });
    setIsSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? "That code didn't work — check your authenticator app and try again.");
      return;
    }
    setEnabled(true);
    setTotpURI(null);
    setBackupCodes(null);
    setPassword("");
    setCode("");
    router.refresh();
  }

  async function handleRegenerate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { data, error: regenError } = await authClient.twoFactor.generateBackupCodes({ password: regeneratePassword });
    setIsSubmitting(false);
    if (regenError) {
      setError(regenError.message ?? "Could not regenerate backup codes.");
      return;
    }
    if (data) setRegeneratedCodes(data.backupCodes);
    setRegeneratePassword("");
  }

  async function handleDisable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: disableError } = await authClient.twoFactor.disable({ password: disablePassword });
    setIsSubmitting(false);
    if (disableError) {
      setError(disableError.message ?? "Could not disable two-factor authentication.");
      return;
    }
    setEnabled(false);
    setIsDisabling(false);
    setDisablePassword("");
    router.refresh();
  }

  async function copyBackupCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCodesCopied(true);
      setTimeout(() => setCodesCopied(false), 2000);
    } catch {
      // Clipboard access can fail silently (permissions, non-secure context) — the codes are
      // still visible on screen to copy by hand, so there's nothing more to do here.
    }
  }

  if (enabled) {
    return (
      <div className={`${s.card} flex flex-col gap-4`}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-500" />
          <h2 className={`font-semibold ${s.heading}`}>Two-factor authentication is on</h2>
        </div>
        <p className={`text-sm ${s.muted}`}>
          Your account is protected with an authenticator app. You&apos;ll be asked for a code every time you sign
          in, unless you&apos;ve marked this device as trusted.
        </p>

        {!isRegenerating && !regeneratedCodes && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={s.secondaryButton} onClick={() => setIsRegenerating(true)}>
              Regenerate backup codes
            </button>
            {!mandatory && !isDisabling && (
              <button type="button" className={s.dangerButton} onClick={() => setIsDisabling(true)}>
                Disable two-factor authentication
              </button>
            )}
          </div>
        )}

        {mandatory && (
          <p className={`text-xs ${s.muted}`}>
            Two-factor authentication is required for your role and can&apos;t be disabled here.
          </p>
        )}

        {isRegenerating && !regeneratedCodes && (
          <form onSubmit={handleRegenerate} className="flex flex-col gap-3">
            <p className={`text-sm ${s.muted}`}>
              Generating new backup codes invalidates your old ones. Confirm your password to continue.
            </p>
            <input
              type="password"
              placeholder="Password"
              className={s.input}
              value={regeneratePassword}
              onChange={(e) => setRegeneratePassword(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <button type="submit" className={s.primaryButton} disabled={isSubmitting}>
                {isSubmitting ? "Generating…" : "Generate new codes"}
              </button>
              <button type="button" className={s.secondaryButton} onClick={() => setIsRegenerating(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {regeneratedCodes && (
          <div className="flex flex-col gap-3">
            <p className={`text-sm ${s.muted}`}>
              Save these somewhere safe — each code works once, and this is the only time they&apos;ll be shown.
            </p>
            <div className={s.codeBox}>
              <div className="grid grid-cols-2 gap-1">
                {regeneratedCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={`${s.secondaryButton} w-fit`}
              onClick={() => {
                setRegeneratedCodes(null);
                setIsRegenerating(false);
              }}
            >
              Done
            </button>
          </div>
        )}

        {isDisabling && (
          <form onSubmit={handleDisable} className="flex flex-col gap-3">
            <p className={`text-sm ${s.muted}`}>Confirm your password to turn off two-factor authentication.</p>
            <input
              type="password"
              placeholder="Password"
              className={s.input}
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <button type="submit" className={s.dangerButton} disabled={isSubmitting}>
                {isSubmitting ? "Disabling…" : "Confirm disable"}
              </button>
              <button type="button" className={s.secondaryButton} onClick={() => setIsDisabling(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p className={s.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={`${s.card} flex flex-col gap-4`}>
      <div className="flex items-center gap-2">
        <ShieldAlert size={20} className="text-amber-500" />
        <h2 className={`font-semibold ${s.heading}`}>Two-factor authentication is off</h2>
      </div>
      <p className={`text-sm ${s.muted}`}>
        {mandatory
          ? "Your role requires two-factor authentication — set it up below to continue to the rest of the app."
          : "Add an authenticator-app code as a second step when you sign in."}
      </p>

      {enrollStep === "start" && (
        <form onSubmit={handleStartEnrollment} className="flex max-w-sm flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className={s.muted}>Confirm your password to begin</span>
            <input
              type="password"
              className={s.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className={s.error}>{error}</p>}
          <button type="submit" className={`${s.primaryButton} self-start`} disabled={isSubmitting}>
            {isSubmitting ? "Starting…" : "Set up two-factor authentication"}
          </button>
        </form>
      )}

      {enrollStep === "confirm" && totpURI && backupCodes && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={`mb-2 text-sm font-medium ${s.heading}`}>1. Scan this with your authenticator app</p>
            <div className="w-fit rounded-md bg-white p-3">
              <QRCodeSVG value={totpURI} size={176} marginSize={2} />
            </div>
            {secret && (
              <p className={`mt-2 text-xs ${s.muted}`}>
                Can&apos;t scan? Enter this key manually: <span className="font-mono">{secret}</span>
              </p>
            )}
          </div>

          <div>
            <p className={`mb-2 text-sm font-medium ${s.heading}`}>2. Save your backup codes</p>
            <p className={`mb-2 text-xs ${s.muted}`}>
              Each code works once and lets you sign in if you lose access to your authenticator app. This is the
              only time they&apos;ll be shown.
            </p>
            <div className={s.codeBox}>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={`mt-2 flex items-center gap-1.5 text-xs ${s.muted}`}
              onClick={() => copyBackupCodes(backupCodes)}
            >
              {codesCopied ? <Check size={14} /> : <Copy size={14} />}
              {codesCopied ? "Copied" : "Copy codes"}
            </button>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={savedCodesConfirmed}
                onChange={(e) => setSavedCodesConfirmed(e.target.checked)}
              />
              I&apos;ve saved these backup codes
            </label>
          </div>

          <form onSubmit={handleConfirmEnrollment} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className={s.muted}>3. Enter the 6-digit code from your app</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className={s.input}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </label>
            {error && <p className={s.error}>{error}</p>}
            <button
              type="submit"
              className={`${s.primaryButton} self-start`}
              disabled={isSubmitting || !savedCodesConfirmed || code.length !== 6}
            >
              {isSubmitting ? "Verifying…" : "Verify & enable"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
