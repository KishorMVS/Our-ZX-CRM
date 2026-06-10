/**
 * Creates the platform owner account.
 * Usage:
 *   node scripts/create-platform-owner.js
 *   node scripts/create-platform-owner.js owner@yourproduct.com MySecurePass123
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2] || "owner@zenxai.io";
    const password = process.argv[3] || "Platform@123";
    const name = process.argv[4] || "Platform Owner";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        if (existing.role === "PLATFORM_OWNER") {
            console.log(`✓ Platform owner already exists: ${email}`);
        } else {
            // Upgrade existing user to platform owner
            await prisma.user.update({
                where: { email },
                data: { role: "PLATFORM_OWNER", workspaceId: null }
            });
            console.log(`✓ Upgraded ${email} to PLATFORM_OWNER`);
        }
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const owner = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role: "PLATFORM_OWNER",
            isActive: true,
            workspaceId: null
        }
    });

    console.log("✓ Platform owner created:");
    console.log(`  Email:    ${owner.email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Login at: /platform/login`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
