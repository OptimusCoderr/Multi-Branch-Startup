-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'POS';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "walkInCounter" INTEGER NOT NULL DEFAULT 0;
