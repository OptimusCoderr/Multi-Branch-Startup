-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "reminderTemplateId" TEXT;

-- CreateTable
CREATE TABLE "DebtReminderTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtReminderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtReminderTemplate_companyId_idx" ON "DebtReminderTemplate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtReminderTemplate_companyId_name_key" ON "DebtReminderTemplate"("companyId", "name");

-- AddForeignKey
ALTER TABLE "DebtReminderTemplate" ADD CONSTRAINT "DebtReminderTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_reminderTemplateId_fkey" FOREIGN KEY ("reminderTemplateId") REFERENCES "DebtReminderTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
