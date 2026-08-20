/**
 * Bootstraps the FIRST super-admin account — a person who can see every
 * company via /admin, entirely outside the per-company Membership/Role
 * system. Run manually, once per environment:
 *
 *   npx tsx scripts/create-platform-admin.ts <email> [name]
 *
 * Only needed once per environment, to get past the chicken-and-egg
 * problem of needing a super admin to grant platform access through the
 * UI (/admin/team) before one exists. After that, use /admin/team to add
 * more super admins or support agents — no need to run this script again.
 *
 * If the account doesn't exist yet, it's created through Better Auth's own
 * signUpEmail() (so the password is hashed exactly the way every other
 * account's is — this script never touches password hashing itself) with a
 * freshly generated strong password, printed once to the console and never
 * written to disk. If the account already exists, its password is left
 * alone and only its platform role is set — safe to re-run.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { auth } from "../src/lib/auth/better-auth";

const prisma = new PrismaClient();

function generateStrongPassword(): string {
  // 24 random bytes, base64url-encoded — well over Better Auth's 10-char
  // minimum, no ambiguous-character concerns since it's copy-pasted, not
  // typed by hand.
  return randomBytes(24).toString("base64url");
}

async function main() {
  const email = process.argv[2];
  const name = process.argv[3] ?? "Platform Admin";
  if (!email) {
    console.error("Usage: npx tsx scripts/create-platform-admin.ts <email> [name]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { platformRole: "SUPER_ADMIN" } });
    console.log(`Existing account ${email} promoted to super admin. Password unchanged.`);
    return;
  }

  const password = generateStrongPassword();
  const result = await auth.api.signUpEmail({ body: { email, name, password } });
  await prisma.user.update({ where: { id: result.user.id }, data: { platformRole: "SUPER_ADMIN" } });

  console.log(`Platform admin account created:`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`This password is shown once and not stored anywhere — save it now.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
