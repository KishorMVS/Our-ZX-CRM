const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Ensure the column exists
        await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "manualCompOffBalance" INTEGER DEFAULT 0');
        console.log('Successfully ensured manualCompOffBalance column exists');
        
        // 2. Double check SLA table again just in case
        await prisma.$executeRawUnsafe('UPDATE "SLA" SET "clientName" = \'Unknown Client\' WHERE "clientName" IS NULL');
        await prisma.$executeRawUnsafe('UPDATE "SLA" SET "clientEmail" = \'unknown@example.com\' WHERE "clientEmail" IS NULL');
        console.log('Cleaned up SLA table');

    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
