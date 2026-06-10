-- Adds only the ZXCallRequest table (avoids db push which would drop drifted columns)
CREATE TABLE IF NOT EXISTS "ZXCallRequest" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT,
  "requestedById" TEXT,
  "gstNumber" TEXT NOT NULL DEFAULT '',
  "companyName" TEXT NOT NULL DEFAULT '',
  "contactName" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "gstCertificate" TEXT,
  "incorporationCertificate" TEXT,
  "aadharCard" TEXT,
  "agents" INTEGER NOT NULL DEFAULT 0,
  "channels" INTEGER NOT NULL DEFAULT 0,
  "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "orderId" TEXT,
  "paymentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ZXCallRequest_workspaceId_idx" ON "ZXCallRequest"("workspaceId");
CREATE INDEX IF NOT EXISTS "ZXCallRequest_status_idx" ON "ZXCallRequest"("status");

DO $$ BEGIN
  ALTER TABLE "ZXCallRequest"
    ADD CONSTRAINT "ZXCallRequest_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
