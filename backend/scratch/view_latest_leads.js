const prisma = require("../src/utils/prisma");

async function main() {
    const leads = await prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
    });
    console.log("Latest leads in DB:", leads.map(l => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        source: l.source,
        callStatus: l.callStatus,
        createdAt: l.createdAt
    })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
