const nodemailer = require("nodemailer");
require("dotenv").config();

async function main() {
    console.log("SMTP_HOST:", process.env.SMTP_HOST || "smtp.gmail.com");
    console.log("SMTP_PORT:", process.env.SMTP_PORT || "587");
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_PASS:", process.env.SMTP_PASS);

    const transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST   || "smtp.gmail.com",
        port:   parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || "",
        },
    });

    console.log("Verifying transporter connection...");
    try {
        await transporter.verify();
        console.log("Transporter verification successful!");
    } catch (err) {
        console.error("Transporter verification failed:", err);
    }
    process.exit(0);
}

main();
