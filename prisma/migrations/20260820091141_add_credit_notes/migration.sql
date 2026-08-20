-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED', 'VOIDED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "creditNoteCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedByMembershipId" TEXT NOT NULL,
    "voidedByMembershipId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNote_companyId_saleId_idx" ON "CreditNote"("companyId", "saleId");

-- CreateIndex
CREATE INDEX "CreditNote_companyId_status_idx" ON "CreditNote"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_companyId_creditNoteNumber_key" ON "CreditNote"("companyId", "creditNoteNumber");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
