-- Create CallyzerExclusion table for hiding individual calls from the dashboard
CREATE TABLE IF NOT EXISTS "CallyzerExclusion" (
    "id"        TEXT NOT NULL,
    "callId"    TEXT NOT NULL,
    "reason"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallyzerExclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CallyzerExclusion_callId_key" ON "CallyzerExclusion"("callId");
