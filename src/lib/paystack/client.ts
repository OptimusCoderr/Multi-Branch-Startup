import "server-only";

const PAYSTACK_API_BASE = "https://api.paystack.co";
const PLACEHOLDER_PREFIX = "sk_test_dev_placeholder";

export class PaystackNotConfiguredError extends Error {
  constructor() {
    super("Billing is not configured in this environment yet — no real Paystack API key is set.");
    this.name = "PaystackNotConfiguredError";
  }
}

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key || key.startsWith(PLACEHOLDER_PREFIX)) {
    throw new PaystackNotConfiguredError();
  }
  return key;
}

type InitializeTransactionInput = {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  reference: string;
  metadata: Record<string, unknown>;
};

type InitializeTransactionResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export async function initializeTransaction(input: InitializeTransactionInput): Promise<InitializeTransactionResult> {
  const secretKey = getSecretKey();

  const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      callback_url: input.callbackUrl,
      reference: input.reference,
      metadata: input.metadata,
    }),
  });

  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message ?? "Paystack failed to initialize the transaction.");
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

type VerifyTransactionResult = {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amountKobo: number;
  customerEmail: string;
  metadata: Record<string, unknown>;
};

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  const secretKey = getSecretKey();

  const response = await fetch(`${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message ?? "Paystack failed to verify the transaction.");
  }

  return {
    status: json.data.status,
    reference: json.data.reference,
    amountKobo: json.data.amount,
    customerEmail: json.data.customer?.email,
    metadata: json.data.metadata ?? {},
  };
}
