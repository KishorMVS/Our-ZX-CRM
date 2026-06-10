/**
 * Assistant Router — Auto-selects the correct ZenVoice assistant for a lead.
 *
 * Strategy:
 *   1. Fetch all assistants from ZenVoice (cached)
 *   2. Match lead.enquiryType against assistant name (fuzzy keyword match)
 *   3. Fallback to the first assistant if no match found
 *
 * Example:
 *   lead.enquiryType = "PRODUCT"  →  assistant named "Product" or "Product Enquiry"
 *   lead.enquiryType = "SERVICES" →  assistant named "Service" or "Services"
 */
const { fetchAssistants } = require("./zenvoiceService");

// Mapping from CRM enquiryType values to keywords to search in assistant names
const ENQUIRY_KEYWORDS = {
    PRODUCT: ["product"],
    SERVICES: ["service"],
    WHITE_LABEL: ["white", "label", "whitelabel"],
    LMS: ["lms", "learning", "management"],
};

/**
 * Detect the best assistant for a given lead.
 * @param {Object} lead - Prisma lead object (must have enquiryType)
 * @returns {Object} { assistantId, assistantName, assistantType }
 */
const detectAssistant = async (lead) => {
    const assistants = await fetchAssistants();

    if (!assistants || assistants.length === 0) {
        throw new Error("[AssistantRouter] No assistants available in ZenVoice account");
    }

    const enquiryType = (lead.enquiryType || "").toUpperCase();
    const keywords = ENQUIRY_KEYWORDS[enquiryType] || [];

    // Try to find a matching assistant by name
    if (keywords.length > 0) {
        for (const assistant of assistants) {
            const name = (assistant.name || assistant.title || "").toLowerCase();
            const matched = keywords.some(kw => name.includes(kw));
            if (matched) {
                return {
                    assistantId: assistant.id,
                    assistantName: assistant.name || assistant.title,
                    assistantType: enquiryType.toLowerCase(),
                };
            }
        }
    }

    // Fallback: use the first assistant
    const fallback = assistants[0];
    console.warn(
        `[AssistantRouter] No assistant matched for enquiryType="${enquiryType}". ` +
        `Falling back to "${fallback.name || fallback.title}" (${fallback.id})`
    );

    return {
        assistantId: fallback.id,
        assistantName: fallback.name || fallback.title,
        assistantType: "default",
    };
};

module.exports = { detectAssistant };
