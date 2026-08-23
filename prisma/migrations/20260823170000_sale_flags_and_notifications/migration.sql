-- CreateEnum
CREATE TYPE "SaleFlagStatus" AS ENUM ('FLAGGED', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SALE_FLAGGED', 'SALE_FLAG_ESCALATED', 'SALE_FLAG_RESOLVED');

-- CreateTable
CREATE TABLE "SaleFlag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "status" "SaleFlagStatus" NOT NULL DEFAULT 'FLAGGED',
    "flaggedByMembershipId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "resolvedByMembershipId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleFlag_companyId_status_idx" ON "SaleFlag"("companyId", "status");

-- CreateIndex
CREATE INDEX "SaleFlag_companyId_saleId_idx" ON "SaleFlag"("companyId", "saleId");

-- CreateIndex
CREATE INDEX "Notification_companyId_membershipId_readAt_idx" ON "Notification"("companyId", "membershipId", "readAt");

-- AddForeignKey
ALTER TABLE "SaleFlag" ADD CONSTRAINT "SaleFlag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleFlag" ADD CONSTRAINT "SaleFlag_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

