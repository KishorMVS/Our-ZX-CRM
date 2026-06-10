-- Adds nullable creator-tracking columns to Task and Sprint.
-- Additive only (avoids db push which would drop drifted columns on the live DB).
ALTER TABLE "Task"   ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Sprint" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- FK constraints (guarded so re-runs are safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Task_createdById_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Sprint_createdById_fkey'
  ) THEN
    ALTER TABLE "Sprint"
      ADD CONSTRAINT "Sprint_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
