-- CreateEnum
CREATE TYPE "DebtReminderChannel" AS ENUM ('SMS');

-- CreateEnum
CREATE TYPE "DebtReminderStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "debtReminderDaysOverdue" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "debtReminderEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DebtReminder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "DebtReminderChannel" NOT NULL DEFAULT 'SMS',
    "message" TEXT NOT NULL,
    "outstandingSnapshot" DECIMAL(12,2) NOT NULL,
    "status" "DebtReminderStatus" NOT NULL,
    "providerResponse" JSONB,
    "error" TEXT,
    "triggeredByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtReminder_companyId_customerId_createdAt_idx" ON "DebtReminder"("companyId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "DebtReminder_companyId_createdAt_idx" ON "DebtReminder"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
