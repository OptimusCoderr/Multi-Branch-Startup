import "server-only";

// Termii (https://termii.com) — a Nigeria-based SMS API, a reasonable
// default given this app's NGN/Africa-Lagos defaults elsewhere. Swappable
// later behind the same sendSms() signature if a company needs a
// different provider/region; nothing else in the codebase depends on
// Termii specifically.
const TERMII_API_BASE = "https://api.ng.termii.com/api";
const PLACEHOLDER_PREFIX = "dev_placeholder_not_a_real_termii_key";

export class SmsNotConfiguredError extends Error {
  constructor() {
    super("SMS is not configured in this environment yet — no real Termii API key is set.");
    this.name = "SmsNotConfiguredError";
  }
}

function getApiKey(): string {
  const key = process.env.TERMII_API_KEY ?? "";
  if (!key || key.startsWith(PLACEHOLDER_PREFIX)) {
    throw new SmsNotConfiguredError();
  }
  return key;
}

function getSenderId(): string {
  return process.env.TERMII_SENDER_ID || "Inventory";
}

/** Non-throwing check for UI display ("SMS isn't configured yet" banners). */
export function isSmsConfigured(): boolean {
  const key = process.env.TERMII_API_KEY ?? "";
  return Boolean(key) && !key.startsWith(PLACEHOLDER_PREFIX);
}

export type SendSmsResult = {
  success: boolean;
  providerResponse?: unknown;
  error?: string;
};

/**
 * Sends a single SMS. Never throws for a provider-side failure (a bad
 * phone number, insufficient Termii balance, etc.) — those come back as
 * `{ success: false, error }` so the caller can record the attempt either
 * way. Only throws SmsNotConfiguredError, since that's a deployment
 * configuration problem the caller needs to handle differently (skip
 * sending entirely, not log a per-message failure).
 */
export async function sendSms(to: string, message: string): Promise<SendSmsResult> {
  const apiKey = getApiKey();

  try {
    const response = await fetch(`${TERMII_API_BASE}/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: getSenderId(),
        sms: message,
        type: "plain",
        channel: "generic",
        api_key: apiKey,
      }),
    });

    const json = await response.json();
    if (!response.ok || json.code !== "ok") {
      return { success: false, providerResponse: json, error: json.message ?? "Termii rejected the message." };
    }

    return { success: true, providerResponse: json };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error sending SMS." };
  }
}
