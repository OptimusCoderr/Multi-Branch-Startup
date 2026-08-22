
-- CreateEnum
CREATE TYPE "SalesReportStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'SENT_BACK', 'REJECTED');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "clientRequestId" TEXT;

-- CreateTable
CREATE TABLE "DailySalesReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "status" "SalesReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "salesCount" INTEGER NOT NULL,
    "grossSalesTotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL,
    "paymentsCollected" DECIMAL(12,2) NOT NULL,
    "cashCollected" DECIMAL(12,2) NOT NULL,
    "declaredCash" DECIMAL(12,2),
    "cashDiscrepancy" DECIMAL(12,2),
    "staffNote" TEXT,
    "ownerNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedByMembershipId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySalesReport_companyId_status_idx" ON "DailySalesReport"("companyId", "status");

-- CreateIndex
CREATE INDEX "DailySalesReport_companyId_branchId_reportDate_idx" ON "DailySalesReport"("companyId", "branchId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesReport_companyId_branchId_membershipId_reportDate_key" ON "DailySalesReport"("companyId", "branchId", "membershipId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_companyId_clientRequestId_key" ON "Sale"("companyId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

