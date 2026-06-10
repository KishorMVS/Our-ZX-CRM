require("dotenv").config();
const prisma = require("../src/utils/prisma");
const webhookController = require("../src/controllers/webhookController");

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

    const mockRes = {
        status: function(code) {
            console.log("Response Status Set:", code);
            return this;
        },
        json: function(data) {
            console.log("Response JSON Called:", data);
            return this;
        }
    };

    const mockReq = {
        body: {
            assistantId: "test-assistant-123",
            toolName: "collect_leads_info",
            room_name: "call-session-999",
            phoneNumber: lead.phone,
            collectedData: {
                name: lead.name,
                phonenum: lead.phone,
                interest: "CRM brochure requested"
            }
        }
    };

    try {
        console.log(`Invoking handleZenVoiceAgentWebhook for ${lead.name} (${lead.phone})...`);
        await webhookController.handleZenVoiceAgentWebhook(mockReq, mockRes);
        console.log("Invocation completed.");
    } catch (err) {
        console.error("Invocation crashed:", err);
    }

    // Wait 10 seconds to allow any async email/WhatsApp dispatch to finish logging
    setTimeout(() => {
        process.exit(0);
    }, 10000);
}

main();
