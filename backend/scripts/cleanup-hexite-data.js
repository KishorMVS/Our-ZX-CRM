/**
 * One-time production cleanup: clears Hexite-specific data from
 * any CompanySettings record that still has it baked in from old defaults.
 *
 * Run on EC2 after deploy:
 *   node scripts/cleanup-hexite-data.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CLEAR = {
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    website: "",
    placeOfSupply: "",
    bankName: "",
    accountNo: "",
    ifsc: "",
    branch: "",
};

async function main() {
    // Clear ALL records that still carry any Hexite-identifiable data
    const result = await prisma.companySettings.updateMany({
        where: {
            OR: [
                { email:       { contains: "hexitetechnologies" } },
                { gstin:       "33AAHCH4159D1ZT"                  },
                { companyName: { contains: "HEXITE"               } },
            ],
        },
        data: CLEAR,
    });

    console.log(`✓ Cleared Hexite data from ${result.count} CompanySettings record(s).`);

    // Show remaining state
    const all = await prisma.companySettings.findMany({
        select: { workspaceId: true, companyName: true, email: true },
    });
    console.log("\nAll CompanySettings after cleanup:");
    all.forEach(s => console.log(`  workspace=${s.workspaceId}  company="${s.companyName}"  email="${s.email}"`));
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
