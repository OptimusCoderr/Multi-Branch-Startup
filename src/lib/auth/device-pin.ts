import "server-only";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;

/**
 * Scrypt (Node's built-in, no new dependency), same discipline as the
 * mobile-2FA-enrollment verification script used elsewhere in this
 * codebase — this is a fast local re-auth gate for switching between
 * staff already fully signed in on one shared shop phone, NOT a
 * standalone credential; it only ever unlocks reactivating a session a
 * real email/password (+2FA, if applicable) login already established.
 */
export function hashDevicePin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyDevicePin(pin: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
