const prisma = require("../utils/prisma");
const { testWorkspaceSmtp } = require("../services/emailService");

const SETTINGS_FIELDS = [
    "companyName", "shortName", "gstin", "address", "city", "state",
    "pincode", "phone", "email", "website", "placeOfSupply", "pan",
    "bankName", "accountNo", "ifsc", "branch", "defaultTaxRate", "defaultNotes",
    "providerSignature",
    "smtpEmail", "smtpPassword", "smtpFromName",
    "logoUrl", "defaultPaymentLink",
    "autoCallEnabled",
    "callScoringConfig",
    "enquiryTypes",
];

const DEFAULT_ENQUIRY_TYPES = ["PRODUCT", "SERVICES", "LMS", "WHITE_LABEL"];

// Always-available manual lead sources (must be valid LeadSource enum values).
const MANUAL_SOURCES = [
    { value: "WEBSITE", label: "Website" },
    { value: "PHONE_CALL", label: "Phone Call" },
    { value: "LINKEDIN", label: "LinkedIn" },
    { value: "CALENDLY", label: "Calendly" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "INSTAGRAM", label: "Instagram" },
];

// Friendly labels for integration platforms (keys are valid LeadSource values).
const INTEGRATION_SOURCE_LABELS = {
    META_ADS: "Meta Ads (Facebook / Instagram)",
    GOOGLE_ADS: "Google Ads",
    GMAIL: "Email (Gmail)",
    GOOGLE_SHEETS: "Google Sheets",
    WEB_FORM: "Web Form",
    WEBHOOK: "Webhook",
};

const pick = (obj, keys) =>
    keys.reduce((acc, k) => { if (obj[k] !== undefined) acc[k] = obj[k]; return acc; }, {});

const getSettings = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (!workspaceId) return res.status(400).json({ message: "No workspace associated with your account" });

        const settings = await prisma.companySettings.findFirst({ where: { workspaceId } });

        // Return empty defaults when no row exists yet (workspace not yet configured)
        if (!settings) return res.json({ workspaceId });

        // Never send raw SMTP password to frontend — mask it
        const result = { ...settings };
        if (result.smtpPassword) result.smtpPassword = "••••••••••••••••";

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching settings", error: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (!workspaceId) return res.status(400).json({ message: "No workspace associated with your account" });

        const data = pick(req.body, SETTINGS_FIELDS);

        // Don't overwrite stored password with masked placeholder
        if (data.smtpPassword === "••••••••••••••••") delete data.smtpPassword;

        // Sanitize enquiryTypes: trimmed, non-empty, de-duplicated.
        if (data.enquiryTypes !== undefined) {
            if (!Array.isArray(data.enquiryTypes)) {
                return res.status(400).json({ message: "enquiryTypes must be an array" });
            }
            const cleaned = [...new Set(
                data.enquiryTypes.map((t) => String(t).trim()).filter(Boolean)
            )];
            if (cleaned.length === 0) {
                return res.status(400).json({ message: "At least one enquiry type is required" });
            }
            data.enquiryTypes = cleaned;
        }

        const settings = await prisma.companySettings.upsert({
            where: { workspaceId },
            update: data,
            create: { workspaceId, ...data },
        });

        const result = { ...settings };
        if (result.smtpPassword) result.smtpPassword = "••••••••••••••••";

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error updating settings", error: error.message });
    }
};

const testSmtp = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (!workspaceId) return res.status(400).json({ message: "No workspace" });

        await testWorkspaceSmtp(workspaceId);
        res.json({ message: "SMTP connection verified successfully" });
    } catch (error) {
        res.status(400).json({ message: "SMTP connection failed", error: error.message });
    }
};

// Lightweight options for the lead form: available sources (manual +
// integration-derived) and the workspace's configured enquiry types.
// Available to any authenticated user (no sensitive data exposed).
const getLeadOptions = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (!workspaceId) return res.status(400).json({ message: "No workspace associated with your account" });

        const [integrations, settings] = await Promise.all([
            prisma.integration.findMany({ where: { workspaceId } }),
            prisma.companySettings.findFirst({ where: { workspaceId }, select: { enquiryTypes: true } }),
        ]);

        // Integration-derived sources (only those that map to a known LeadSource).
        const integrationSources = integrations
            .filter((i) => INTEGRATION_SOURCE_LABELS[i.platform])
            .map((i) => ({
                value: i.platform,
                label: INTEGRATION_SOURCE_LABELS[i.platform],
                connected: !!i.isConnected,
            }));

        // Merge manual + integration sources, de-duplicated by value.
        const seen = new Set();
        const sources = [...integrationSources, ...MANUAL_SOURCES].filter((s) => {
            if (seen.has(s.value)) return false;
            seen.add(s.value);
            return true;
        });

        const enquiryTypes = settings?.enquiryTypes?.length
            ? settings.enquiryTypes
            : DEFAULT_ENQUIRY_TYPES;

        res.json({ sources, enquiryTypes });
    } catch (error) {
        res.status(500).json({ message: "Error fetching lead options", error: error.message });
    }
};

module.exports = { getSettings, updateSettings, testSmtp, getLeadOptions };
