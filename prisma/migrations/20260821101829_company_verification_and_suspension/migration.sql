-- CreateEnum
CREATE TYPE "CompanyVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'APPROVED_WITHOUT_CAC');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "cacCertificateUrl" TEXT,
ADD COLUMN     "cacSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "disabledByUserId" TEXT,
ADD COLUMN     "disabledReason" TEXT,
ADD COLUMN     "incorporationDate" TIMESTAMP(3),
ADD COLUMN     "rcNumber" TEXT,
ADD COLUMN     "statusBeforeSuspension" "CompanyStatus",
ADD COLUMN     "verificationDeadline" TIMESTAMP(3),
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "verificationReviewedByUserId" TEXT,
ADD COLUMN     "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateIndex
CREATE INDEX "Company_verificationStatus_idx" ON "Company"("verificationStatus");
