-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "reminderCreditBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderCreditsRefreshedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "devicePinHash" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unitLabel" TEXT NOT NULL DEFAULT 'unit';

