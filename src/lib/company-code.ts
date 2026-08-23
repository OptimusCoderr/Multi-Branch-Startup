import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * The code a staff member types at self-service sign-up (see
 * staff-signup-service.ts) to request to join a company — always present,
 * globally unique, set once at company creation. If the Owner gave a real
 * RC number at sign-up, that's normalized and used directly (a company's
 * real RC number is already meant to be unique); otherwise a random
 * BIZ-XXXXXXXX code is generated. Distinct from Company.rcNumber, which
 * stays free-form and resubmittable for the separate CAC-verification
 * flow — this is fixed forever once set.
 */
/**
 * Same normalization on both ends of the lookup: applied here when an
 * Owner's rcNumber becomes a companyCode, and again in
 * staff-signup.ts on whatever a staff member types in — so "rc 123 456",
 * "RC123456", and "rc123456" all resolve to the same company.
 */
export function normalizeCompanyCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easier to read aloud/type
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BIZ-${suffix}`;
}

export class CompanyCodeTakenError extends Error {
  constructor() {
    super("A company is already registered with that RC number.");
    this.name = "CompanyCodeTakenError";
  }
}

/**
 * Resolves the companyCode to use for a newly-created company. Throws
 * CompanyCodeTakenError if an explicit rcNumber collides with an existing
 * company (a real RC number should never legitimately belong to two
 * companies). A generated fallback retries on the astronomically unlikely
 * chance of a collision.
 */
export async function resolveCompanyCode(rcNumber: string | undefined): Promise<string> {
  if (rcNumber) {
    const normalized = normalizeCompanyCode(rcNumber);
    const existing = await prisma.company.findUnique({ where: { companyCode: normalized } });
    if (existing) throw new CompanyCodeTakenError();
    return normalized;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRandomCode();
    const existing = await prisma.company.findUnique({ where: { companyCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique company code — please try again.");
}
