-- AlterTable
-- Nullable first, then backfilled, then made NOT NULL — a bare `ADD COLUMN
-- ... NOT NULL` with no default fails outright against any account table
-- that already has rows (every company's email/password sign-up creates
-- one). Every account created before this migration went through the
-- credential (email/password) flow, so "local:credential" is the correct
-- backfill value, matching what better-auth itself writes for new
-- credential accounts.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;
UPDATE "account" SET "issuer" = 'local:credential' WHERE "issuer" IS NULL;
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
