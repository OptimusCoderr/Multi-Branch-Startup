import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Paystack's `x-paystack-signature` header: HMAC-SHA512 of the
 * raw request body using the account's secret key. Must run against the
 * raw (unparsed) body — JSON.stringify(JSON.parse(body)) is not guaranteed
 * to reproduce the exact bytes Paystack signed. Uses a constant-time
 * comparison so response timing can't leak how much of the signature
 * matched.
 */
export function verifyPaystackSignature(rawBody: string, signatureHeader: string | null, secretKey: string): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
