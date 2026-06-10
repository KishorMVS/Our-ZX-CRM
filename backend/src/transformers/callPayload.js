/**
 * Call Payload Transformer
 * Converts a CRM Lead object into the ZenVoice make_call JSON format.
 *
 * ZenVoice expects:
 * {
 *   "phoneNumber": "+1234567890",
 *   "fromPhoneNumber": "+19282185402",
 *   "selectedAssistant": "5c8a4399-4fbb-4c82-a351-537dbe6fc328",
 *   "metadata": { "name": "...", "email": "...", "company": "...", "phone": "..." }
 * }
 */

/**
 * Normalize a phone number to E.164 format (+91XXXXXXXXXX for India).
 * @param {string} phone - Raw phone string
 * @returns {string} Normalized phone number
 */
const normalizePhone = (phone) => {
    if (!phone) return "";

    // Strip all non-digit characters
    let cleaned = phone.replace(/\D/g, "");

    // If starts with 0, remove and add +91
    if (cleaned.startsWith("0")) {
        cleaned = "91" + cleaned.substring(1);
    }

    // If exactly 10 digits (Indian mobile), prepend 91
    if (cleaned.length === 10) {
        cleaned = "91" + cleaned;
    }

    // Ensure + prefix
    if (!cleaned.startsWith("+")) {
        cleaned = "+" + cleaned;
    }

    return cleaned;
};

/**
 * Build the ZenVoice make_call payload from a CRM lead.
 * @param {Object} lead - Prisma Lead object
 * @param {string} assistantId - ZenVoice assistant UUID
 * @param {string} fromPhoneNumber - Registered outgoing DID (from .env)
 * @returns {Object} ZenVoice-compatible payload
 */
const buildCallPayload = (lead, assistantId, fromPhoneNumber) => {
    return {
        phoneNumber: normalizePhone(lead.phone),
        fromPhoneNumber: fromPhoneNumber,
        selectedAssistant: assistantId,
        metadata: {
            name: lead.name || "Unknown",
            email: lead.email || "",
            company: lead.company || "",
            phone: normalizePhone(lead.phone),
            crmLeadId: lead.id,
            source: lead.source || "",
            enquiryType: lead.enquiryType || "",
        },
    };
};

module.exports = { buildCallPayload, normalizePhone };
