/**
 * Lead Call Service — Orchestrator
 * Called after a lead is created in the CRM (from ANY source).
 * Decides whether to queue the lead for an AI outbound call.
 *
 * Guards:
 *   1. Lead must have a phone number
 *   2. Lead must not already be called/queued
 *   3. Auto-calling must be enabled globally
 *   4. Must be within business hours (or delay to next window)
 *   5. Duplicate call prevention
 */
const prisma = require("../utils/prisma");
const { enqueueCall, executeCallDirectly } = require("../queues/callQueue");
const { isRedisConnected } = require("../queues/redisConnection");

// ── Source-based Priority ────────────────────────────────────────────────────
// Lower number = higher priority in BullMQ
const SOURCE_PRIORITY = {
    META_ADS: 1,
    FACEBOOK: 1,
    INSTAGRAM: 2,
    GOOGLE_ADS: 2,
    GOOGLE_SHEETS: 3,
    GMAIL: 3,
    WEBHOOK: 4,
    WEB_FORM: 4,
    WEBSITE: 5,
    PHONE_CALL: 5,
    LINKEDIN: 5,
    CALENDLY: 5,
};

// ── Business Hours ───────────────────────────────────────────────────────────
/**
 * Calculate delay (in ms) to the next business hours window.
 * If currently within business hours, returns 0.
 * Business hours: CALL_HOURS_START to CALL_HOURS_END (IST).
 */
const getBusinessHoursDelay = () => {
    const startStr = process.env.CALL_HOURS_START || "09:00";
    const endStr = process.env.CALL_HOURS_END || "18:00";

    const [startHr, startMin] = startStr.split(":").map(Number);
    const [endHr, endMin] = endStr.split(":").map(Number);

    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
    const istNow = new Date(now.getTime() + istOffset);

    const currentMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
    const startMinutes = startHr * 60 + (startMin || 0);
    const endMinutes = endHr * 60 + (endMin || 0);

    // Within business hours
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return 0;
    }

    // Before business hours today — delay until start
    if (currentMinutes < startMinutes) {
        return (startMinutes - currentMinutes) * 60 * 1000;
    }

    // After business hours — delay until tomorrow's start
    const minutesTillMidnight = 1440 - currentMinutes;
    const minutesTillStart = minutesTillMidnight + startMinutes;
    return minutesTillStart * 60 * 1000;
};

// ── Main Orchestrator ────────────────────────────────────────────────────────
/**
 * Process a newly created lead for AI outbound calling.
 * Called from lead creation endpoints (capture, webhook, manual, CSV import).
 *
 * @param {Object} lead - The Prisma lead object (must have id, phone, source, enquiryType)
 */
const processNewLead = async (lead) => {
    try {
        // Guard 1: Global toggle
        const settings = await prisma.companySettings.findFirst({
            where: lead.workspaceId ? { workspaceId: lead.workspaceId } : undefined
        });
        const isAutoCallEnabled = settings ? settings.autoCallEnabled : false;

        if (!isAutoCallEnabled) {
            return;
        }

        // Guard 2: Must have phone
        if (!lead.phone) {
            console.log(`[LeadCallService] Lead ${lead.id} has no phone — skipping auto-call`);
            return;
        }

        // Guard 3: Already processed
        if (lead.callStatus && ["queued", "calling", "completed"].includes(lead.callStatus)) {
            console.log(`[LeadCallService] Lead ${lead.id} already ${lead.callStatus} — skipping`);
            return;
        }

        // Guard 4: ZenVoice credentials must be configured
        if (!process.env.ZENVOICE_EMAIL || !process.env.ZENVOICE_PASSWORD) {
            console.warn("[LeadCallService] ZenVoice credentials not configured — skipping auto-call");
            return;
        }

        if (!process.env.ZENVOICE_FROM_PHONE) {
            console.warn("[LeadCallService] ZENVOICE_FROM_PHONE not configured — skipping auto-call");
            return;
        }

        // Calculate priority based on lead source
        const priority = SOURCE_PRIORITY[lead.source] || 5;

        // Calculate business hours delay
        const delay = getBusinessHoursDelay();

        if (delay > 0) {
            const delayHours = (delay / (1000 * 60 * 60)).toFixed(1);
            console.log(`[LeadCallService] Lead ${lead.id} scheduled for ${delayHours}h from now (outside business hours)`);
        }

        // Update lead status to "queued"
        await prisma.lead.update({
            where: { id: lead.id },
            data: { callStatus: "queued" },
        });

        // Check if Redis queue connection is online
        if (isRedisConnected()) {
            // Enqueue the call job via BullMQ
            await enqueueCall(lead.id, { priority, delay });
            console.log(`[LeadCallService] Lead ${lead.name} (${lead.source}) queued via Redis for auto-call (priority: ${priority})`);
        } else {
            // Redis is offline — trigger call immediately via the robust in-memory fallback!
            console.log(`[LeadCallService] ℹ️ Redis is offline. Triggering Direct In-Memory Call fallback for ${lead.name}...`);
            // Run in background (fire-and-forget) so we don't hold up lead creation
            setImmediate(async () => {
                try {
                    await executeCallDirectly(lead.id);
                } catch (fallbackErr) {
                    console.error("[LeadCallService] Direct call fallback failed:", fallbackErr.message);
                }
            });
        }
    } catch (err) {
        // Never let auto-call errors break lead creation
        console.error(`[LeadCallService] Error processing lead ${lead.id}:`, err.message);
    }
};

module.exports = { processNewLead };
