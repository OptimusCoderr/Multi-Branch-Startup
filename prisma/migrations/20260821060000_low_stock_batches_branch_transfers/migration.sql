-- AlterEnum
ALTER TYPE "StockTransferSourceType" ADD VALUE 'BRANCH';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "reorderPoint" INTEGER,
ADD COLUMN     "tracksBatches" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "sourceBranchId" TEXT;

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityRemaining" INTEGER NOT NULL,
    "receivedByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductBatch_companyId_productId_idx" ON "ProductBatch"("companyId", "productId");

-- CreateIndex
CREATE INDEX "ProductBatch_companyId_expiryDate_idx" ON "ProductBatch"("companyId", "expiryDate");

-- CreateIndex
CREATE INDEX "ProductBatch_companyId_branchId_idx" ON "ProductBatch"("companyId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_companyId_productId_branchId_batchNumber_key" ON "ProductBatch"("companyId", "productId", "branchId", "batchNumber");

-- CreateIndex
CREATE INDEX "StockTransfer_companyId_sourceBranchId_idx" ON "StockTransfer"("companyId", "sourceBranchId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

