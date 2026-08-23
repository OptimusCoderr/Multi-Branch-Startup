import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "product">;

// Unambiguous when read aloud/typed during stock-taking — no 0/O/1/I.
const SUFFIX_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function baseCode(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return letters.slice(0, 3).padEnd(3, "X");
}

function randomSuffix(): string {
  let suffix = "";
  for (let i = 0; i < 3; i++) {
    suffix += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return suffix;
}

/**
 * Generates a product's SKU — first 3 letters of its name, uppercased
 * (non-letters stripped, padded with X if the name has fewer than 3
 * letters). If that code is already taken by another product in this
 * company, a random 3-character suffix is appended (e.g. MTN-4X7) until a
 * free one is found. SKUs are set once at creation and never editable
 * afterward — see product-form.tsx.
 */
export async function generateProductSku(tx: ScopedTx, name: string): Promise<string> {
  const base = baseCode(name);

  const existing = await tx.product.findFirst({ where: { sku: base } });
  if (!existing) return base;

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${base}-${randomSuffix()}`;
    const taken = await tx.product.findFirst({ where: { sku: candidate } });
    if (!taken) return candidate;
  }
  throw new Error("Could not generate a unique SKU — please try again.");
}
