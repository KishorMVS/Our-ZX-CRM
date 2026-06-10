-- Rename SalestrailCall → CallyzerCall (idempotent).
-- SalestrailCall was created via db push (no CREATE migration exists), so the
-- shadow database never has it. We handle all three states:
--   A) SalestrailCall exists  → rename to CallyzerCall
--   B) CallyzerCall exists    → already done, skip
--   C) Neither exists         → create CallyzerCall from scratch (shadow DB path)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SalestrailCall' AND relkind = 'r') THEN

    -- A: rename table
    ALTER TABLE "SalestrailCall" RENAME TO "CallyzerCall";

    -- rename unique column salestrailId → callyzerCallId
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'CallyzerCall' AND column_name = 'salestrailId'
    ) THEN
      ALTER TABLE "CallyzerCall" RENAME COLUMN "salestrailId" TO "callyzerCallId";
    END IF;

    -- rename index
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SalestrailCall_salestrailId_key') THEN
      ALTER INDEX "SalestrailCall_salestrailId_key" RENAME TO "CallyzerCall_callyzerCallId_key";
    END IF;

    -- rename primary key constraint
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'SalestrailCall_pkey') THEN
      ALTER TABLE "CallyzerCall" RENAME CONSTRAINT "SalestrailCall_pkey" TO "CallyzerCall_pkey";
    END IF;

    -- rename foreign key constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalestrailCall_leadId_fkey') THEN
      ALTER TABLE "CallyzerCall" RENAME CONSTRAINT "SalestrailCall_leadId_fkey" TO "CallyzerCall_leadId_fkey";
    END IF;

  ELSIF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'CallyzerCall' AND relkind = 'r') THEN

    -- C: shadow DB path — create CallyzerCall from scratch
    CREATE TABLE "CallyzerCall" (
      "id"             TEXT NOT NULL,
      "callyzerCallId" TEXT,
      "direction"      TEXT NOT NULL DEFAULT 'outgoing',
      "status"         TEXT,
      "duration"       INTEGER NOT NULL DEFAULT 0,
      "fromNumber"     TEXT,
      "toNumber"       TEXT,
      "agentName"      TEXT,
      "agentEmail"     TEXT,
      "contactName"    TEXT,
      "contactPhone"   TEXT,
      "recordingUrl"   TEXT,
      "notes"          TEXT,
      "rawPayload"     JSONB,
      "startedAt"      TIMESTAMP(3),
      "endedAt"        TIMESTAMP(3),
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "leadId"         TEXT,
      CONSTRAINT "CallyzerCall_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "CallyzerCall_callyzerCallId_key" ON "CallyzerCall"("callyzerCallId");

  END IF;
  -- B: CallyzerCall already exists — nothing to do
END $$;
