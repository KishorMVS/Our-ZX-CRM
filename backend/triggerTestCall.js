require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { makeCall } = require("./src/services/zenvoiceService");
const { detectAssistant } = require("./src/services/assistantRouter");
const { buildCallPayload } = require("./src/transformers/callPayload");

async function main() {
    const latestLead = await prisma.lead.findFirst({
        orderBy: { createdAt: "desc" }
    });

    if (!latestLead) {
        console.error("No lead found in the database!");
        return;
    }

    const { assistantId, assistantName } = await detectAssistant(latestLead);

    // Let's test calling with the alternative Plivo Indian number: +918035316457
    const altFromPhone = "+918035316457";
    console.log(`\n📞 Testing call with alternate fromPhoneNumber: ${altFromPhone}`);
    console.log(`👤 Target: ${latestLead.name} (${latestLead.phone})`);
    
    const payload = buildCallPayload(latestLead, assistantId, altFromPhone);

    try {
        const response = await makeCall(payload);
        console.log("\n🎉 Call initiated successfully!", JSON.stringify(response, null, 2));
    } catch (err) {
        console.error("\n❌ Call failed:", err.message);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
