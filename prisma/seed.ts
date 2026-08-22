// `npm run db:seed` invokes this script directly (tsx prisma/seed.ts),
// which — unlike `prisma migrate deploy`/`generate` — doesn't go through
// Prisma's own config loader (prisma.config.ts's `import "dotenv/config"`),
// so .env has to be loaded explicitly here or this only works when the
// shell already happens to have those variables exported.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PERMISSION_CATALOG, SYSTEM_ROLE_NAMES, DEFAULT_ROLE_PERMISSIONS } from "../src/lib/auth/permissions";
import { slugify } from "../src/lib/validation/onboarding.schema";
import { DEFAULT_EXPENSE_CATEGORIES } from "../src/lib/expenses/default-categories";
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

  // Local-dev convenience: a normal tenant Owner account with its own
  // Company already created, so `npm run dev` alone is enough to have a
  // working "log in as a regular company admin" login ready — the same
  // steps createCompanyForCurrentUser() (src/server/actions/onboarding.ts)
  // runs after a real sign-up, just replicated here without the
  // request-scoped getSession()/headers() that action needs (there's no
  // HTTP request in a seed script). Safe to re-run: only acts when the
  // account doesn't exist yet, or exists but has no company membership yet
  // — an account that already owns a company is left completely alone, so
  // this never creates duplicate companies for the same person.
  const companyAdminEmail = process.env.COMPANY_ADMIN_EMAIL;
  const companyAdminPassword = process.env.COMPANY_ADMIN_PASSWORD;
  if (companyAdminEmail && companyAdminPassword) {
    console.log(`Seeding local company admin account (${companyAdminEmail})...`);
    let ownerUser = await prisma.user.findUnique({ where: { email: companyAdminEmail } });
    if (!ownerUser) {
      const result = await auth.api.signUpEmail({
        body: { email: companyAdminEmail, name: process.env.COMPANY_ADMIN_NAME ?? "Demo Owner", password: companyAdminPassword },
      });
      ownerUser = await prisma.user.findUnique({ where: { id: result.user.id } });
    }

    const existingMembership = ownerUser
      ? await prisma.membership.findFirst({ where: { userId: ownerUser.id, status: { in: ["ACTIVE", "INVITED"] } } })
      : null;

    if (ownerUser && !existingMembership) {
      const companyName = process.env.COMPANY_ADMIN_COMPANY_NAME ?? "Demo Company";
      const baseSlug = slugify(companyName) || "company";
      let slug = baseSlug;
      let attempt = 0;
      while (await prisma.company.findUnique({ where: { slug } })) {
        attempt += 1;
        slug = `${baseSlug}-${attempt + 1}`;
      }

      const starterPlan = await prisma.plan.findUnique({ where: { name: "Starter" } });
      const permissions = await prisma.permission.findMany();
      const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: companyName,
            slug,
            status: "TRIAL",
            verificationDeadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
          },
        });

        const roleByName = new Map<string, string>();
        for (const roleName of SYSTEM_ROLE_NAMES) {
          const role = await tx.role.create({ data: { companyId: company.id, name: roleName, isSystem: true } });
          roleByName.set(roleName, role.id);

          const grantedKeys = DEFAULT_ROLE_PERMISSIONS[roleName] ?? [];
          const rolePermissionRows = grantedKeys
            .map((key) => permissionIdByKey.get(key))
            .filter((id): id is string => Boolean(id))
            .map((permissionId) => ({ roleId: role.id, permissionId }));
          if (rolePermissionRows.length > 0) {
            await tx.rolePermission.createMany({ data: rolePermissionRows });
          }
        }

        await tx.membership.create({
          data: {
            companyId: company.id,
            userId: ownerUser!.id,
            roleId: roleByName.get("Owner"),
            status: "ACTIVE",
            joinedAt: now,
          },
        });

        await tx.expenseCategory.createMany({
          data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ companyId: company.id, name })),
        });

        if (starterPlan) {
          await tx.subscription.create({
            data: {
              companyId: company.id,
              planId: starterPlan.id,
              status: "TRIALING",
              trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            },
          });
        }
      });

      console.log(`Created company "${companyName}" (${slug}) with ${companyAdminEmail} as Owner.`);
    } else if (ownerUser) {
      console.log(`${companyAdminEmail} already belongs to a company — leaving it alone.`);
    }
  } else {
    console.log("COMPANY_ADMIN_EMAIL/COMPANY_ADMIN_PASSWORD not set — skipping local company admin account (see .env.example).");
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
