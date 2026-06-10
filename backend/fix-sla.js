const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe('UPDATE "SLA" SET "clientName" = \'Unknown Client\' WHERE "clientName" IS NULL');
        await prisma.$executeRawUnsafe('UPDATE "SLA" SET "clientEmail" = \'unknown@example.com\' WHERE "clientEmail" IS NULL');
        console.log('Successfully fixed SLA table');
    } catch (err) {
        console.error('Failed to fix SLA table:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
