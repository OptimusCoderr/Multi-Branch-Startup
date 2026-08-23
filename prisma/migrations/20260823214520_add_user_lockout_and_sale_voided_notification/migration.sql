-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SALE_VOIDED';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
