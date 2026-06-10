-- c2c department flag + TeleCMI provisioning fields on users (additive, safe)
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "c2c" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isC2C" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telecmiExtension" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telecmiAgentId" TEXT;
