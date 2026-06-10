/**
 * fix-role-migration.js
 * Fixes schema drift: creates Role/UserPermission tables, migrates
 * User.role (string) → User.roleId (FK to Role table).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('🔧 Starting role migration fix...');

  // 1. Create Role table if it doesn't exist
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Role" (
      "id"          TEXT NOT NULL,
      "name"        TEXT NOT NULL,
      "description" TEXT,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");
  `);
  console.log('✅ Role table ready');

  // 2. Create Permission table if it doesn't exist
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Permission" (
      "id"       TEXT NOT NULL,
      "roleId"   TEXT NOT NULL,
      "resource" TEXT NOT NULL,
      "action"   TEXT NOT NULL,
      CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Permission_roleId_resource_action_key"
      ON "Permission"("roleId", "resource", "action");
  `);
  console.log('✅ Permission table ready');

  // 3. Create UserPermission table if it doesn't exist
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserPermission" (
      "id"       TEXT NOT NULL,
      "userId"   TEXT NOT NULL,
      "resource" TEXT NOT NULL,
      "action"   TEXT NOT NULL,
      CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_resource_action_key"
      ON "UserPermission"("userId", "resource", "action");
  `);
  console.log('✅ UserPermission table ready');

  // 4. Seed default roles
  const defaultRoles = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'HR'];
  for (const roleName of defaultRoles) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Role" ("id", "name", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, CURRENT_TIMESTAMP)
      ON CONFLICT ("name") DO NOTHING;
    `, roleName);
  }
  console.log('✅ Default roles seeded:', defaultRoles.join(', '));

  // 5. Add roleId column to User (nullable) if it doesn't exist
  const hasRoleId = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'roleId'
  `;
  if (hasRoleId.length === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "roleId" TEXT;`);
    console.log('✅ Added roleId column to User');
  } else {
    console.log('ℹ️  roleId column already exists on User');
  }

  // 6. Migrate existing User.role (string) values → User.roleId
  const roles = await prisma.$queryRaw`SELECT "id", "name" FROM "Role"`;
  const roleMap = {};
  for (const r of roles) roleMap[r.name.toUpperCase()] = r.id;

  // Get distinct role values in User table
  const userRoles = await prisma.$queryRaw`
    SELECT DISTINCT "role" FROM "User" WHERE "role" IS NOT NULL AND "roleId" IS NULL
  `;
  console.log('ℹ️  Existing role strings to migrate:', userRoles.map(r => r.role));

  for (const { role } of userRoles) {
    const upper = (role || '').toUpperCase();
    const roleId = roleMap[upper] || roleMap['EMPLOYEE'];
    if (roleId) {
      await prisma.$executeRawUnsafe(`
        UPDATE "User" SET "roleId" = $1 WHERE UPPER("role") = $2 AND "roleId" IS NULL
      `, roleId, upper);
      console.log(`  → Mapped role "${role}" → roleId ${roleId}`);
    }
  }

  // 7. Set default EMPLOYEE role for any users still without roleId
  const employeeRoleId = roleMap['EMPLOYEE'];
  if (employeeRoleId) {
    const updated = await prisma.$executeRawUnsafe(`
      UPDATE "User" SET "roleId" = $1 WHERE "roleId" IS NULL
    `, employeeRoleId);
    if (updated > 0) console.log(`✅ Set EMPLOYEE as default for ${updated} user(s) with no role`);
  }

  // 8. Add FK constraint if not already present
  const fkExists = await prisma.$queryRaw`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'User' AND constraint_name = 'User_roleId_fkey'
  `;
  if (fkExists.length === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
        ADD CONSTRAINT "User_roleId_fkey"
        FOREIGN KEY ("roleId") REFERENCES "Role"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('✅ Added FK constraint User.roleId → Role.id');
  } else {
    console.log('ℹ️  FK constraint already exists');
  }

  // 9. Add FK constraint for Permission → Role
  const permFkExists = await prisma.$queryRaw`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'Permission' AND constraint_name = 'Permission_roleId_fkey'
  `;
  if (permFkExists.length === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Permission"
        ADD CONSTRAINT "Permission_roleId_fkey"
        FOREIGN KEY ("roleId") REFERENCES "Role"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('✅ Added FK constraint Permission.roleId → Role.id');
  }

  // 10. Add FK for UserPermission → User
  const upFkExists = await prisma.$queryRaw`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'UserPermission' AND constraint_name = 'UserPermission_userId_fkey'
  `;
  if (upFkExists.length === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "UserPermission"
        ADD CONSTRAINT "UserPermission_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('✅ Added FK constraint UserPermission.userId → User.id');
  }

  console.log('\n🎉 Migration fix complete! Regenerating Prisma client...');
}

run()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
