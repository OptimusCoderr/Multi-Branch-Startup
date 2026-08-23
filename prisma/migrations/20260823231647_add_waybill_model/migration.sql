-- CreateEnum
CREATE TYPE "WaybillStatus" AS ENUM ('PENDING', 'MATCHED', 'LOCKED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WAYBILL_LOCKED';

-- AlterEnum
ALTER TYPE "StockMovementReason" ADD VALUE 'TRANSFER_REVERSED';

-- CreateTable
CREATE TABLE "Waybill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "WaybillStatus" NOT NULL DEFAULT 'PENDING',
    "mismatchAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastDeclaredQuantity" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "resolvedByMembershipId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waybill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Waybill_stockTransferId_key" ON "Waybill"("stockTransferId");

-- CreateIndex
CREATE INDEX "Waybill_companyId_status_idx" ON "Waybill"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Waybill_companyId_reference_key" ON "Waybill"("companyId", "reference");

-- AddForeignKey
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
