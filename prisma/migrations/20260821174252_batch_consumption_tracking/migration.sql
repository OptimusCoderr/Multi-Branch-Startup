-- AlterTable
ALTER TABLE "SaleLineItem" ADD COLUMN     "batchConsumption" JSONB;

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "dispatchedBatches" JSONB;
