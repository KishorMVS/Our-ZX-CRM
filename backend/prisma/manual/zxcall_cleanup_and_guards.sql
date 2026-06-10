-- Drop the unused legacy column
ALTER TABLE "ZXCallRequest" DROP COLUMN IF EXISTS "extensionId";

-- Prevent two users in the same workspace ever sharing a TeleCMI extension
CREATE UNIQUE INDEX IF NOT EXISTS "User_workspace_telecmiExtension_key"
  ON "User" ("workspaceId", "telecmiExtension")
  WHERE "telecmiExtension" IS NOT NULL;
