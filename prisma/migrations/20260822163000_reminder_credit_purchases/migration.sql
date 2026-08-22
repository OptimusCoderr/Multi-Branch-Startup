-- CreateTable
CREATE TABLE "ReminderCreditPurchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderCreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderCreditPurchase_reference_key" ON "ReminderCreditPurchase"("reference");

-- CreateIndex
CREATE INDEX "ReminderCreditPurchase_companyId_idx" ON "ReminderCreditPurchase"("companyId");

-- AddForeignKey
ALTER TABLE "ReminderCreditPurchase" ADD CONSTRAINT "ReminderCreditPurchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

