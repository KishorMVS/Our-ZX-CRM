-- Oversight ("see everything") removed for all roles. Drop the per-user flag.
ALTER TABLE "User" DROP COLUMN IF EXISTS "canOversee";
