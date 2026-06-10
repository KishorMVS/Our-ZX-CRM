-- Adds provisioning credential columns to ZXCallRequest (additive, safe)
ALTER TABLE "ZXCallRequest" ADD COLUMN IF NOT EXISTS "sipUserId" TEXT;
ALTER TABLE "ZXCallRequest" ADD COLUMN IF NOT EXISTS "secretKey" TEXT;
ALTER TABLE "ZXCallRequest" ADD COLUMN IF NOT EXISTS "didNumber" TEXT;
ALTER TABLE "ZXCallRequest" ADD COLUMN IF NOT EXISTS "extensionId" TEXT;
