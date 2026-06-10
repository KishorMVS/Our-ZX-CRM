-- c2c user-license quota on the onboarding request (additive, safe)
ALTER TABLE "ZXCallRequest" ADD COLUMN IF NOT EXISTS "userLimit" INTEGER NOT NULL DEFAULT 0;
