-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GOODS', 'SERVICE');

-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "companyCode" TEXT;

-- Backfill: every existing company needs a unique companyCode before the
-- NOT NULL + UNIQUE constraints below can apply. Generated the same shape
-- the app itself would generate for a company with no RC number
-- (see src/lib/company-code.ts) — random enough that a collision across a
-- handful of existing rows is not a practical concern.
UPDATE "Company" SET "companyCode" = 'BIZ-' || upper(substr(md5(random()::text || id), 1, 8)) WHERE "companyCode" IS NULL;

ALTER TABLE "Company" ALTER COLUMN "companyCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'GOODS';

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyCode_key" ON "Company"("companyCode");
