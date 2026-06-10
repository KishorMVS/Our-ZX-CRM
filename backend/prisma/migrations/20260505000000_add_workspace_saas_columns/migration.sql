-- Add missing multi-tenant columns to Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill slug from name for existing rows (slugify: lowercase, replace spaces with hyphens)
UPDATE "Workspace" SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) WHERE "slug" IS NULL;

-- Make slug NOT NULL and UNIQUE after backfill
ALTER TABLE "Workspace" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

-- Add missing workspaceId to CompanySettings
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CompanySettings_workspaceId_key" ON "CompanySettings"("workspaceId");
ALTER TABLE "CompanySettings" ADD CONSTRAINT IF NOT EXISTS "CompanySettings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add missing workspaceId to Department
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Department" ADD CONSTRAINT IF NOT EXISTS "Department_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix Department unique constraint (name + workspaceId) if not present
DROP INDEX IF EXISTS "Department_name_workspaceId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_workspaceId_key" ON "Department"("name", "workspaceId");
