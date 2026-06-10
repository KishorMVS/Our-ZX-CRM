-- Fix schema drift: DB uses roleId (relational Role table) but Prisma schema expects role (enum)
-- This migration adds the Role enum type and role column, then populates from existing data.

-- Step 1: Create the Role enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TEAM_LEAD', 'AGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add role column to User table if it doesn't exist
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'EMPLOYEE';

-- Step 3: Populate role from existing roleId -> Role.name mapping
UPDATE "User" u
SET "role" = r.name::"Role"
FROM "Role" r
WHERE r.id = u."roleId" AND u."roleId" IS NOT NULL;

-- Step 4: Fix Permission table - add role enum column if the table uses text
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Permission' AND column_name = 'role'
        AND udt_name = 'Role'
    ) THEN
        -- If role column is text, convert it; if missing, add it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'Permission' AND column_name = 'role'
        ) THEN
            ALTER TABLE "Permission" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
        ELSE
            ALTER TABLE "Permission" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'EMPLOYEE';
        END IF;
    END IF;
END $$;
