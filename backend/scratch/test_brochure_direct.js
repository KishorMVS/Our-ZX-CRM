require("dotenv").config();
const prisma = require("../src/utils/prisma");
const emailService = require("../src/services/emailService");
const whatsappService = require("../src/services/whatsappService");

async function main() {
    const lead = await prisma.lead.findUnique({
        where: { id: "8041c75a-0140-4e9c-8042-8a1cf80b8d24" }
    });

    console.log("Queried Lead:", lead);

    console.log("\n--- Testing Email Send ---");
    try {
        const company = await prisma.companySettings.findFirst({
            where: { workspaceId: lead.workspaceId || undefined }
        });
        console.log("Company Settings:", company);
        
        await emailService.sendCRMBrochureEmail({
            lead,
            company,
            workspaceId: lead.workspaceId
        });
        console.log("Email send function completed successfully.");
    } catch (err) {
        console.error("Email send function failed:", err);
    }

    console.log("\n--- Testing WhatsApp Send ---");
    try {
        const path = require("path");
        const brochurePath = path.join(__dirname, "../../../frontend/src/assets/CRM broucher.pdf");
        
        await whatsappService.sendWhatsAppMedia({
            to: lead.phone,
            filePath: brochurePath,
            caption: `Hi ${lead.name || "there"}, following up on our conversation, here is our CRM brochure! Let us know if you have any questions.`
        });
        console.log("WhatsApp send function completed successfully.");
    } catch (err) {
        console.error("WhatsApp send function failed:", err);
    }

    process.exit(0);
}

main().catch(err => {
    console.error("Main failed:", err);
    process.exit(1);
});
