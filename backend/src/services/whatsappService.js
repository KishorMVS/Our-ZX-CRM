const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

/**
 * Send media/document via WhatsApp Meta API
 * @param {string} to - Recipient phone number (e.g. +91XXXXXXXXXX)
 * @param {string} filePath - Absolute path to the file
 * @param {string} caption - Message text to accompany the media
 */
const sendWhatsAppMedia = async ({ to, filePath, caption }) => {
    try {
        const token = process.env.META_JWT;
        const assistantId = "0c3d3843-e720-4bd1-b182-17c15616329e";

        if (!token) {
            console.warn("[WhatsAppService] META_JWT is not configured in .env. Skipping WhatsApp send.");
            return;
        }

        if (!fs.existsSync(filePath)) {
            console.warn(`[WhatsAppService] Media file not found at: ${filePath}. Skipping WhatsApp send.`);
            return;
        }

        // Normalize phone number to include country code if not present (default to +91)
        let cleanPhone = to.replace(/\D/g, "");
        if (cleanPhone.length === 10) {
            cleanPhone = "91" + cleanPhone;
        }
        const recipient = "+" + cleanPhone;

        const form = new FormData();
        form.append("assistantId", assistantId);
        form.append("to", recipient);
        if (caption) {
            form.append("caption", caption);
        }
        form.append("file", fs.createReadStream(filePath), {
            filename: path.basename(filePath),
            contentType: "application/pdf"
        });

        console.log(`[WhatsAppService] Sending WhatsApp media to ${recipient}...`);
        const response = await axios.post("https://chat.zenxai.io/api/meta/send-media-upload", form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });

        console.log(`[WhatsAppService] WhatsApp sent successfully to ${recipient}:`, response.data);
        return response.data;
    } catch (error) {
        const errDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[WhatsAppService] Failed to send WhatsApp to ${to}:`, errDetails);
        throw error;
    }
};

module.exports = { sendWhatsAppMedia };
