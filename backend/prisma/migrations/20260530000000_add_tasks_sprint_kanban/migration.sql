-- ─── Fix Lead.enquiryType: cast TEXT → EnquiryType enum if needed ────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnquiryType') THEN
    CREATE TYPE "EnquiryType" AS ENUM ('PRODUCT', 'WHITE_LABEL', 'LMS', 'SERVICES');
  END IF;
END $$;

DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'Lead' AND column_name = 'enquiryType';

  IF col_type = 'text' OR col_type = 'character varying' THEN
    ALTER TABLE "Lead" ALTER COLUMN "enquiryType" TYPE "EnquiryType"
      USING "enquiryType"::"EnquiryType";
  END IF;
END $$;

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "KanbanStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Priority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TaskType" AS ENUM ('EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SprintStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Sprint table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Sprint" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "goal"        TEXT,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3) NOT NULL,
    "status"      "SprintStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT,
    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Task: make assignedToId nullable ─────────────────────────────────────────

ALTER TABLE "Task" ALTER COLUMN "assignedToId" DROP NOT NULL;

-- ─── Task: add missing columns ────────────────────────────────────────────────

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "description"     TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "completedAt"     TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "estimatedHours"  DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "actualHours"     DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "storyPoints"     INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "labels"          TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "orderIndex"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sprintId"        TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "workspaceId"     TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add enum columns with a cast-safe default approach
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "kanbanStatus" "KanbanStatus" NOT NULL DEFAULT 'TODO';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "priority"     "Priority"     NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "type"         "TaskType"     NOT NULL DEFAULT 'TASK';

-- ─── Task: foreign keys ───────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey"
    FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Also make the existing Task.assignedToId FK SET NULL on delete (was RESTRICT)
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedToId_fkey";
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TaskComment table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TaskComment" (
    "id"        TEXT NOT NULL,
    "taskId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TaskFile table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TaskFile" (
    "id"        TEXT NOT NULL,
    "taskId"    TEXT NOT NULL,
    "fileName"  TEXT NOT NULL,
    "fileUrl"   TEXT NOT NULL,
    "fileSize"  INTEGER NOT NULL,
    "mimeType"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
