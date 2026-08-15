-- CreateEnum
CREATE TYPE "PaystackEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "PaystackEvent" (
    "id" TEXT NOT NULL,
    "paystackEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PaystackEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaystackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaystackEvent_paystackEventId_key" ON "PaystackEvent"("paystackEventId");

-- CreateIndex
CREATE INDEX "PaystackEvent_eventType_idx" ON "PaystackEvent"("eventType");
