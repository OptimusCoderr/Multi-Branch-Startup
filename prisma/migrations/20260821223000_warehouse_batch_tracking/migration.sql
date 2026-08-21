-- DropForeignKey
ALTER TABLE "ProductBatch" DROP CONSTRAINT "ProductBatch_branchId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_destinationBranchId_fkey";

-- AlterTable
ALTER TABLE "ProductBatch" ADD COLUMN     "warehouseId" TEXT,
ALTER COLUMN "branchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "destinationWarehouseId" TEXT,
ALTER COLUMN "destinationBranchId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ProductBatch_companyId_warehouseId_idx" ON "ProductBatch"("companyId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_companyId_productId_warehouseId_batchNumber_key" ON "ProductBatch"("companyId", "productId", "warehouseId", "batchNumber");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense-in-depth: a batch lives at exactly one location, never both,
-- never neither. Prisma's schema language has no syntax for this, so it's
-- added directly here.
ALTER TABLE "ProductBatch" ADD CONSTRAINT "product_batch_exactly_one_location" CHECK (
  ("branchId" IS NOT NULL AND "warehouseId" IS NULL) OR ("branchId" IS NULL AND "warehouseId" IS NOT NULL)
);

-- Same guarantee for a StockTransfer's destination.
ALTER TABLE "StockTransfer" ADD CONSTRAINT "stock_transfer_exactly_one_destination" CHECK (
  ("destinationBranchId" IS NOT NULL AND "destinationWarehouseId" IS NULL) OR ("destinationBranchId" IS NULL AND "destinationWarehouseId" IS NOT NULL)
);

