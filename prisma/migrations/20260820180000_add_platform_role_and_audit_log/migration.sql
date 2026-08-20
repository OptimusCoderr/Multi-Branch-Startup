-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_AGENT');

-- AlterTable: add the new column first, backfill from the old one, then drop it
ALTER TABLE "user" ADD COLUMN "platformRole" "PlatformRole";
UPDATE "user" SET "platformRole" = 'SUPER_ADMIN' WHERE "isPlatformAdmin" = true;
ALTER TABLE "user" DROP COLUMN "isPlatformAdmin";

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetEmail" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorUserId_idx" ON "PlatformAuditLog"("actorUserId");
