-- Idempotent: recreate VoiceLinkClient if it was dropped, then add userId linkage

CREATE TABLE IF NOT EXISTS "VoiceLinkClient" (
    "id"           TEXT NOT NULL,
    "clientId"     INTEGER NOT NULL,
    "username"     TEXT NOT NULL,
    "password"     TEXT NOT NULL,
    "token"        TEXT,
    "tokenExpiry"  TIMESTAMP(3),
    "channelCount" INTEGER NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoiceLinkClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceLinkClient_clientId_key" ON "VoiceLinkClient"("clientId");

ALTER TABLE "VoiceLinkClient" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceLinkClient_userId_key" ON "VoiceLinkClient"("userId");

ALTER TABLE "VoiceLinkClient" DROP CONSTRAINT IF EXISTS "VoiceLinkClient_userId_fkey";
ALTER TABLE "VoiceLinkClient" ADD CONSTRAINT "VoiceLinkClient_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
