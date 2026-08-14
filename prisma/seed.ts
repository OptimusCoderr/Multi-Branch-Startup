import { PrismaClient } from "@prisma/client";
import { PERMISSION_CATALOG } from "../src/lib/auth/permissions";

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
