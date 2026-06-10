require("dotenv").config();
const prisma = require("../src/utils/prisma");
const webhookController = require("../src/controllers/webhookController");
const { executeCallDirectly } = require("../src/queues/callQueue");

async function main() {
    console.log("Cleaning up old test leads...");
    await prisma.activity.deleteMany({});
    await prisma.note.deleteMany({});
    await prisma.callLog.deleteMany({});
    await prisma.lead.deleteMany({});

    console.log("1. Creating a new mock lead...");
    const lead = await prisma.lead.create({
        data: {
            name: "Test John Doe",
            email: "test.johndoe@example.com",
            phone: "+919999999999",
            status: "NEW",
            callStatus: "queued",
            score: 0,
            scoreUpdated: false,
            enquiryType: "LMS",
            source: "WEBSITE",
            workspaceId: "test-workspace-id"
        }
    });
    console.log("Created lead:", lead.id);

    const mockCallId = "call-session-test-12345";

    console.log("Creating mock CallLog in DB...");
    const callLog = await prisma.callLog.create({
        data: {
            leadId: lead.id,
            userId: "system",
            callType: "OUTBOUND",
            callStatus: "INITIATED",
            toNumber: lead.phone,
            sessionId: mockCallId,
            agentNumber: "+917943446745",
            callDate: new Date(),
        }
    });
    console.log("Created CallLog:", callLog.id);

    // Mocking response objects
    const mockRes = {
        status: function (code) {
            console.log(`[Res Status] ${code}`);
            return this;
        },
        json: function (data) {
            console.log(`[Res JSON]`, data);
            return this;
        },
        send: function (data) {
            console.log(`[Res Send]`, data);
            return this;
        }
    };

    console.log("\n3. Testing retry logic (Simulating Lead NOT attending the AI call)...");
    const mockEventReq = {
        body: {
            call_id: mockCallId,
            from: "+917943446745",
            to: lead.phone,
            status: "failed", // no answer
            direction: "outbound"
        }
    };

    await webhookController.handleVoiceLinkCallEvent(mockEventReq, mockRes);

    // Wait a brief moment for async timeout/retry to log
    await new Promise(r => setTimeout(r, 1000));

    // Check if lead was queued back for retry
    let updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    console.log("Lead callStatus after no-answer event:", updatedLead.callStatus);

    console.log("\n4. Testing conversion & scoring (Simulating AI call completes successfully)...");
    // Send agent webhook data
    const mockAgentReq = {
        body: {
            assistantId: "test-assistant-123",
            toolName: "collect_leads_info",
            room_name: mockCallId,
            collectedData: {
                name: "Test John Doe Modified",
                phonenum: lead.phone,
                interest: "Wants premium features"
            }
        }
    };

    await webhookController.handleZenVoiceAgentWebhook(mockAgentReq, mockRes);

    // Wait for brochure sends to execute or fail gracefully
    console.log("Waiting 5s for email/whatsapp brochure callbacks...");
    await new Promise(r => setTimeout(r, 5000));

    // Verify lead's final status and score
    updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id },
        include: { notes: true, activities: true }
    });
    console.log("Lead final score (expected 25):", updatedLead.score);
    console.log("Lead final status (expected CONVERTED):", updatedLead.status);
    console.log("Lead scoreUpdated flag:", updatedLead.scoreUpdated);
    console.log("Lead Notes:", updatedLead.notes.map(n => n.content));
    console.log("Lead Activities:", updatedLead.activities.map(a => a.action));

    console.log("Disconnecting prisma...");
    await prisma.$disconnect();
}

main().catch(console.error);
