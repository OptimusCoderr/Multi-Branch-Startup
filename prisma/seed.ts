// `npm run db:seed` invokes this script directly (tsx prisma/seed.ts),
// which — unlike `prisma migrate deploy`/`generate` — doesn't go through
// Prisma's own config loader (prisma.config.ts's `import "dotenv/config"`),
// so .env has to be loaded explicitly here or this only works when the
// shell already happens to have those variables exported.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PERMISSION_CATALOG } from "../src/lib/auth/permissions";
import { auth } from "../src/lib/auth/better-auth";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding permission catalog...");
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { category: permission.category, description: permission.description },
      create: permission,
    });
  }

  console.log("Seeding subscription plans...");
  await prisma.plan.upsert({
    where: { name: "Solo" },
    update: {},
    create: {
      name: "Solo",
      priceKobo: 500_000, // NGN 5,000/mo
      billingInterval: "MONTHLY",
      // maxWarehouses: 0 is a real cap, not "uncapped" — parsePlanFeatures()
      // and assertUnderWarehouseLimit() both special-case 0 correctly
      // (checked via `typeof === "number"` / `!== undefined`, not truthiness).
      features: { maxBranches: 1, maxWarehouses: 0, maxStaff: 2 },
    },
  });
  await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      priceKobo: 1_500_000, // NGN 15,000/mo
      billingInterval: "MONTHLY",
      features: { maxBranches: 2, maxWarehouses: 1, maxStaff: 10 },
    },
  });
  await prisma.plan.upsert({
    where: { name: "Growth" },
    update: {},
    create: {
      name: "Growth",
      priceKobo: 4_000_000, // NGN 40,000/mo
      billingInterval: "MONTHLY",
      features: { maxBranches: 10, maxWarehouses: 5, maxStaff: 50 },
    },
  });

  // Local-dev convenience only: if ADMIN_EMAIL/ADMIN_PASSWORD are set (see
  // .env.example), ensure that account exists and can see /admin — so
  // `npm run db:seed` alone is enough to have a login ready, no separate
  // step to run or password to hunt down in console output. Deliberately
  // NOT for real deployments: unlike scripts/create-platform-admin.ts
  // (which always generates a fresh random password, shown once), this
  // uses a fixed password from .env on purpose, since the whole point is
  // a predictable local login. Safe to re-run: an existing account's
  // password is left untouched, only its platform role is (re)confirmed —
  // and ONLY if it was already platform staff (or is a brand-new account
  // this run just created). If ADMIN_EMAIL happens to collide with an
  // unrelated ordinary account that signed up normally (e.g. someone on a
  // shared/staging DB who never overrode .env.example's admin@example.com
  // default), re-seeding must never silently upgrade that stranger's
  // account to SUPER_ADMIN.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    console.log(`Seeding local admin account (${adminEmail})...`);
    let user = await prisma.user.findUnique({ where: { email: adminEmail } });
    let justCreated = false;
    if (!user) {
      const result = await auth.api.signUpEmail({ body: { email: adminEmail, name: "Admin", password: adminPassword } });
      user = await prisma.user.findUnique({ where: { id: result.user.id } });
      justCreated = true;
    }
    if (user && (justCreated || user.platformRole)) {
      await prisma.user.update({ where: { id: user.id }, data: { platformRole: "SUPER_ADMIN" } });
    } else if (user) {
      console.warn(
        `ADMIN_EMAIL (${adminEmail}) already belongs to an existing account that isn't platform staff — leaving it alone. ` +
          `Use scripts/create-platform-admin.ts, or pick a different ADMIN_EMAIL, if you meant to grant it access.`,
      );
    }
  } else {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping local admin account (see .env.example).");
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
