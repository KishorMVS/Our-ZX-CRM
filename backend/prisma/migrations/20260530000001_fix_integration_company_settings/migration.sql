-- ─── Fix Integration table: add missing columns & fix unique index ────────────

-- Add missing columns (idempotent)
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "workspaceId"   TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "name"          TEXT NOT NULL DEFAULT '';
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "isActive"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "isConnected"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "config"        JSONB;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "leadsCaptures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "lastLeadAt"    TIMESTAMP(3);
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "lastSynced"    TIMESTAMP(3);
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add FK for workspaceId
DO $$ BEGIN
  ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The old unique index was on platform alone; drop it and replace with (workspaceId, platform)
DROP INDEX IF EXISTS "Integration_platform_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Integration_workspaceId_platform_key"
  ON "Integration"("workspaceId", "platform");

-- ─── CompanySettings: create if missing, then add any new columns ─────────────

CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id"                 TEXT NOT NULL,
    "workspaceId"        TEXT UNIQUE,
    "companyName"        TEXT NOT NULL DEFAULT '',
    "shortName"         TEXT NOT NULL DEFAULT '',
    "gstin"             TEXT NOT NULL DEFAULT '',
    "address"           TEXT NOT NULL DEFAULT '',
    "city"              TEXT NOT NULL DEFAULT '',
    "state"             TEXT NOT NULL DEFAULT '',
    "pincode"           TEXT NOT NULL DEFAULT '',
    "phone"             TEXT NOT NULL DEFAULT '',
    "email"             TEXT NOT NULL DEFAULT '',
    "website"           TEXT NOT NULL DEFAULT '',
    "placeOfSupply"     TEXT NOT NULL DEFAULT '',
    "pan"               TEXT NOT NULL DEFAULT '',
    "webhookBaseUrl"    TEXT,
    "bankName"          TEXT NOT NULL DEFAULT '',
    "accountNo"         TEXT NOT NULL DEFAULT '',
    "ifsc"              TEXT NOT NULL DEFAULT '',
    "branch"            TEXT NOT NULL DEFAULT '',
    "defaultTaxRate"    DOUBLE PRECISION NOT NULL DEFAULT 18,
    "defaultNotes"      TEXT NOT NULL DEFAULT '',
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voiceLinkToken"    TEXT NOT NULL DEFAULT '',
    "providerSignature" TEXT,
    "fasterqApiKey"     TEXT NOT NULL DEFAULT '',
    "captureToken"      TEXT NOT NULL DEFAULT '',
    "smtpEmail"         TEXT NOT NULL DEFAULT '',
    "smtpPassword"      TEXT NOT NULL DEFAULT '',
    "smtpFromName"      TEXT NOT NULL DEFAULT '',
    "defaultPaymentLink" TEXT NOT NULL DEFAULT '',
    "logoUrl"           TEXT,
    "autoCallEnabled"   BOOLEAN NOT NULL DEFAULT false,
    "callScoringConfig" JSONB,
    "enquiryTypes"      TEXT[] NOT NULL DEFAULT ARRAY['PRODUCT','SERVICES','LMS','WHITE_LABEL'],
    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- If table already existed, add any missing columns
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "workspaceId"         TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "companyName"         TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "shortName"           TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "gstin"               TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "address"             TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "city"                TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "state"               TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "pincode"             TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "phone"               TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "email"               TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "website"             TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "placeOfSupply"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "pan"                 TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "webhookBaseUrl"      TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "bankName"            TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "accountNo"           TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "ifsc"                TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "branch"              TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "defaultTaxRate"      DOUBLE PRECISION NOT NULL DEFAULT 18;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "defaultNotes"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "voiceLinkToken"      TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "providerSignature"   TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "fasterqApiKey"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "captureToken"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "smtpEmail"           TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "smtpPassword"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "smtpFromName"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "defaultPaymentLink"  TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "logoUrl"             TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "autoCallEnabled"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "callScoringConfig"   JSONB;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "enquiryTypes"        TEXT[] NOT NULL DEFAULT ARRAY['PRODUCT','SERVICES','LMS','WHITE_LABEL'];

-- Ensure unique index on workspaceId
CREATE UNIQUE INDEX IF NOT EXISTS "CompanySettings_workspaceId_key" ON "CompanySettings"("workspaceId");

-- Ensure FK
DO $$ BEGIN
  ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
