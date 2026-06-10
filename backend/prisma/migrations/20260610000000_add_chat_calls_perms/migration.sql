-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CallStatus" AS ENUM ('ANSWERED', 'MISSED', 'DECLINED', 'CANCELLED', 'BLOCKED_OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── User: chat privilege flags ──────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canCreateGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canOversee"     BOOLEAN NOT NULL DEFAULT false;

-- ─── CallEvent: in-app peer-to-peer call history ─────────────────────────────

CREATE TABLE IF NOT EXISTS "CallEvent" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT,
  "channelCid"  TEXT NOT NULL,
  "callerId"    TEXT NOT NULL,
  "calleeId"    TEXT,
  "callType"    "CallType" NOT NULL,
  "status"      "CallStatus" NOT NULL,
  "startedAt"   TIMESTAMP(3) NOT NULL,
  "answeredAt"  TIMESTAMP(3),
  "endedAt"     TIMESTAMP(3),
  "durationSec" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CallEvent_workspaceId_idx" ON "CallEvent"("workspaceId");
CREATE INDEX IF NOT EXISTS "CallEvent_callerId_idx"    ON "CallEvent"("callerId");
CREATE INDEX IF NOT EXISTS "CallEvent_calleeId_idx"    ON "CallEvent"("calleeId");
CREATE INDEX IF NOT EXISTS "CallEvent_channelCid_idx"  ON "CallEvent"("channelCid");

DO $$ BEGIN
  ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_callerId_fkey"
    FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_calleeId_fkey"
    FOREIGN KEY ("calleeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
