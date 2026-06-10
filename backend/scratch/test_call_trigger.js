require("dotenv").config();
const prisma = require("../src/utils/prisma");
const { executeCallDirectly } = require("../src/queues/callQueue");

async function main() {
    // Find the latest lead in the database
    const lead = await prisma.lead.findFirst({
        orderBy: { createdAt: "desc" }
    });

    if (!lead) {
        console.error("No lead found in database!");
        return;
    }

    console.log("Found latest lead:", lead);

    // Reset callStatus so it doesn't get skipped as 'already called'
    await prisma.lead.update({
        where: { id: lead.id },
        data: { callStatus: "queued" }
    });

    console.log(`Triggering executeCallDirectly for ${lead.name}...`);
    const result = await executeCallDirectly(lead.id);
    console.log("Result:", result);

    // Wait 10 seconds to allow async operations (email and whatsapp) to complete and log
    console.log("Waiting 10s for async operations to complete...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("Done.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
