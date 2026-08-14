import "server-only";
import { randomBytes, createHash } from "node:crypto";

/**
 * Invitation links carry a random token in the URL; only its SHA-256 hash
 * is stored in the database (mirrors password/API-key handling) so a
 * database read or backup leak can't be used to forge an invite.
 */
export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
