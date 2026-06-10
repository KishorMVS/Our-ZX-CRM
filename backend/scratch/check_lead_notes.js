const prisma = require("../src/utils/prisma");

async function main() {
    const lead = await prisma.lead.findUnique({
        where: { id: "8041c75a-0140-4e9c-8042-8a1cf80b8d24" },
        include: { notes: true, activities: true }
    });

    console.log("Lead Name:", lead.name);
    console.log("Lead Email:", lead.email);
    console.log("Lead Status:", lead.status);
    console.log("Lead Notes count:", lead.notes.length);
    console.log("Lead Notes:");
    lead.notes.forEach(n => console.log(`- [${n.createdAt}] ${n.content}`));
    console.log("Lead Activities count:", lead.activities.length);
    console.log("Lead Activities:");
    lead.activities.forEach(a => console.log(`- [${a.createdAt}] Action: ${a.action} | Metadata: ${JSON.stringify(a.metadata)}`));

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
