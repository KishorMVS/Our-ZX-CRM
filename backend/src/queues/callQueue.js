/**
 * BullMQ Call Queue + Worker
 * Processes outbound AI calls one-by-one with retry, backoff, and concurrency control.
 *
 * Queue: "ai-outbound-call"
 * Worker: fetches lead → classifies → transforms → calls ZenVoice → logs result
 */
const { Queue, Worker } = require("bullmq");
const { getRedisConnection } = require("./redisConnection");
const prisma = require("../utils/prisma");
const { detectAssistant } = require("../services/assistantRouter");
const { buildCallPayload } = require("../transformers/callPayload");
const { makeCall } = require("../services/zenvoiceService");
const logActivity = require("../utils/activityLogger");
const emailService = require("../services/emailService");

const QUEUE_NAME = "ai-outbound-call";

let queue = null;
let worker = null;

// ── Queue Instance ───────────────────────────────────────────────────────────
const getCallQueue = () => {
    if (queue) return queue;

    queue = new Queue(QUEUE_NAME, {
        connection: getRedisConnection(),
        defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: "exponential",
                delay: 5000, // 5s → 10s → 20s → 40s → 80s
            },
            removeOnComplete: { count: 500 },  // Keep last 500 completed
            removeOnFail: { count: 1000 },      // Keep last 1000 failed
        },
    });

    console.log("[CallQueue] Queue created: " + QUEUE_NAME);
    return queue;
};

// ── Add Job to Queue ─────────────────────────────────────────────────────────
/**
 * Enqueue a lead for an AI outbound call.
 * @param {string} leadId - The CRM lead ID
 * @param {Object} options - { priority, delay }
 *   priority: 1 = highest (Meta Ads), 5 = lowest (manual)
 *   delay: ms to wait before processing (for business hours)
 */
const enqueueCall = async (leadId, options = {}) => {
    const q = getCallQueue();

    await q.add("make-call", { leadId }, {
        priority: options.priority || 5,
        delay: options.delay || 0,
        jobId: `call-${leadId}`, // Prevent duplicate jobs for same lead
    });

    console.log(`[CallQueue] Lead ${leadId} queued (priority: ${options.priority || 5}, delay: ${options.delay || 0}ms)`);
};

// ── Direct In-Memory Call Trigger (Fallback & Core Logic) ───────────────────
/**
 * Execute an outbound call directly to ZenVoice without needing Redis/BullMQ.
 * Used as a high-reliability fallback when Redis is down, and as the core processor for the worker.
 */
const executeCallDirectly = async (leadId) => {
    const fromPhone = process.env.ZENVOICE_FROM_PHONE;

    if (!fromPhone) {
        throw new Error("ZENVOICE_FROM_PHONE not configured");
    }

    // 1. Fetch lead from DB
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) {
        console.warn(`[CallDirect] Lead ${leadId} not found — skipping`);
        return { status: "skipped", reason: "lead_not_found" };
    }

    if (!lead.phone) {
        await prisma.lead.update({
            where: { id: leadId },
            data: { callStatus: "skipped" },
        });
        console.warn(`[CallDirect] Lead ${leadId} has no phone — skipped`);
        return { status: "skipped", reason: "no_phone" };
    }

    if (lead.callStatus === "completed") {
        console.log(`[CallDirect] Lead ${leadId} already called — skipping`);
        return { status: "skipped", reason: "already_called" };
    }

    // 2. Classify — pick the right assistant
    const { assistantId, assistantName, assistantType } = await detectAssistant(lead);
    console.log(`[CallDirect] Lead ${lead.name} → Assistant: ${assistantName} (${assistantType})`);

    // 3. Transform — build ZenVoice payload
    const payload = buildCallPayload(lead, assistantId, fromPhone);

    // 4. Update lead status to "calling"
    await prisma.lead.update({
        where: { id: leadId },
        data: {
            callStatus: "calling",
            assistantId: assistantId,
            assistantType: assistantType,
            lastCallAttempt: new Date(),
            callRetryCount: { increment: 1 },
        },
    });

    // 5. Call ZenVoice API
    const response = await makeCall(payload);

    // 6. Extract call ID from response
    // ZenVoice returns: { callLogId, room_name, sip_details: { sip_call_id } }
    const zenvoiceCallId = response?.callLogId || response?.room_name || response?.sip_details?.sip_call_id || null;

    // 7. Update lead with success
    await prisma.lead.update({
        where: { id: leadId },
        data: {
            callStatus: "completed",
            zenvoiceCallId: zenvoiceCallId ? String(zenvoiceCallId) : null,
            status: "AI_CONTACTED",
        },
    });

    // 8. Create CallLog record
    await prisma.callLog.create({
        data: {
            leadId: leadId,
            userId: "system",
            callType: "OUTBOUND",
            callStatus: "INITIATED",
            toNumber: payload.phoneNumber,
            sessionId: zenvoiceCallId ? String(zenvoiceCallId) : null,
            agentNumber: fromPhone,
            callDate: new Date(),
        },
    });

    // 9. Log activity
    await logActivity({
        leadId: leadId,
        action: "AI_AUTO_CALL_INITIATED",
        metadata: {
            assistantId,
            assistantName,
            assistantType,
            zenvoiceCallId,
            phoneNumber: payload.phoneNumber,
        },
    });

    // Send introductory Email and WhatsApp welcome messages
    if (lead.email) {
        try {
            const company = await prisma.companySettings.findFirst({
                where: { workspaceId: lead.workspaceId || undefined }
            });
            emailService.sendCRMBrochureEmail({
                lead,
                company,
                workspaceId: lead.workspaceId
            }).catch(err => {
                console.error("[CallQueue] Failed to send initial CRM brochure email:", err.message);
            });
        } catch (err) {
            console.error("[CallQueue] Failed to fetch company settings for email:", err.message);
        }
    }

    if (lead.phone) {
        const path = require("path");
        const brochurePath = path.join(__dirname, "../../../frontend/src/assets/CRM broucher.pdf");
        const whatsappService = require("../services/whatsappService");
        whatsappService.sendWhatsAppMedia({
            to: lead.phone,
            filePath: brochurePath,
            caption: `Hi ${lead.name || "there"}, we are calling you now to discuss ZX-CRM! 📞 Meanwhile, please find our introductory CRM brochure attached.`
        }).catch(err => {
            console.error("[CallQueue] Failed to send initial WhatsApp welcome:", err.message);
        });
    }

    console.log(`✅ [CallDirect] Call initiated successfully: ${lead.name} (${payload.phoneNumber}) → ${assistantName}`);

    return {
        status: "success",
        leadId,
        zenvoiceCallId,
        assistantName,
    };
};

// ── Worker Process ───────────────────────────────────────────────────────────
const startWorker = () => {
    const concurrency = parseInt(process.env.CALL_QUEUE_CONCURRENCY) || 3;
    const fromPhone = process.env.ZENVOICE_FROM_PHONE;

    if (!fromPhone) {
        console.warn("[CallQueue] ⚠️ ZENVOICE_FROM_PHONE not set — worker will skip calls until configured");
    }

    worker = new Worker(
        QUEUE_NAME,
        async (job) => {
            return await executeCallDirectly(job.data.leadId);
        },
        {
            connection: getRedisConnection(),
            concurrency,
        }
    );

    // ── Worker Event Handlers ────────────────────────────────────────────────
    worker.on("completed", (job, result) => {
        if (result?.status === "success") {
            console.log(`[CallWorker] ✅ Job ${job.id} completed: ${result.leadId}`);
        }
    });

    worker.on("failed", async (job, err) => {
        console.error(`[CallWorker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);

        // Update lead callStatus to "failed" if all retries exhausted
        if (job && job.attemptsMade >= (job.opts?.attempts || 5)) {
            try {
                await prisma.lead.update({
                    where: { id: job.data.leadId },
                    data: { callStatus: "failed" },
                });

                await logActivity({
                    leadId: job.data.leadId,
                    action: "AI_AUTO_CALL_FAILED",
                    metadata: {
                        error: err.message,
                        attempts: job.attemptsMade,
                    },
                });
            } catch (dbErr) {
                console.error("[CallWorker] Failed to update lead status:", dbErr.message);
            }
        }
    });

    worker.on("error", (err) => {
        // Suppress repetitive Redis connection errors to keep the console clean
        const msg = err && err.message ? err.message : String(err);
        if (msg.includes("ECONNREFUSED") || msg.includes("Redis connection") || msg.includes("loading") || msg.includes("unreachable")) {
            return;
        }
        console.error("[CallWorker] Worker error:", msg);
    });

    console.log(`[CallQueue] Worker started (concurrency: ${concurrency})`);
    return worker;
};

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const closeQueue = async () => {
    if (worker) await worker.close();
    if (queue) await queue.close();
    console.log("[CallQueue] Queue and worker closed");
};

module.exports = {
    getCallQueue,
    enqueueCall,
    startWorker,
    executeCallDirectly,
    closeQueue,
};
