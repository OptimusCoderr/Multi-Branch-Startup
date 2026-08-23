-- DropForeignKey
ALTER TABLE "SaleLineItem" DROP CONSTRAINT "SaleLineItem_productId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "productType";

-- AlterTable
ALTER TABLE "SaleLineItem" ADD COLUMN     "adHocDescription" TEXT,
ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "productId" DROP NOT NULL;

-- DropEnum
DROP TYPE "ProductType";

-- AddForeignKey
ALTER TABLE "SaleLineItem" ADD CONSTRAINT "SaleLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
