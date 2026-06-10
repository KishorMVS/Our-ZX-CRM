const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
    const transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST   || "smtp.gmail.com",
        port:   parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || "",
        },
    });

    console.log("Sending simple email...");
    try {
        await transporter.sendMail({
            from: `"ZenXAI CRM" <${process.env.SMTP_USER}>`,
            to: "harsha@hexitetechnologies.com",
            subject: "Simple Test Email",
            text: "This is a simple test email"
        });
        console.log("Simple email sent!");
    } catch (err) {
        console.error("Simple email failed:", err);
    }

    console.log("Sending email with attachment...");
    try {
        const brochurePath = path.join(__dirname, "../../frontend/src/assets/CRM broucher.pdf");
        console.log("Checking brochure path:", brochurePath);
        console.log("File exists?", fs.existsSync(brochurePath));

        await transporter.sendMail({
            from: `"ZenXAI CRM" <${process.env.SMTP_USER}>`,
            to: "harsha@hexitetechnologies.com",
            subject: "Attachment Test Email",
            text: "This is an email with attachment",
            attachments: [
                {
                    filename: "CRM Brochure.pdf",
                    path: brochurePath,
                    contentType: "application/pdf"
                }
            ]
        });
        console.log("Email with attachment sent!");
    } catch (err) {
        console.error("Attachment email failed:", err);
    }

    process.exit(0);
}

main();
