const prisma = require("../utils/prisma");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const emailService = require("../services/emailService");
const { routeLead } = require("../utils/leadRouter");

// Handle Incoming Webhook for Lead Creation
const handleLeadWebhook = async (req, res) => {
    try {
        const { source, name, email, phone, enquiryType, metadata } = req.body;

        // Basic validation
        if (!name || !phone) {
            return res.status(400).json({ message: "Name and Phone are required" });
        }

        // Validate Source
        const validSources = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL"];
        const leadSource = validSources.includes(source) ? source : "WEBSITE"; // Default to WEBSITE

        // Scoring
        const { score, category } = calculateLeadScore({ source: leadSource, phone, email });

        // Check for duplicates (Simple check)
        const existingLead = await prisma.lead.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: phone }
                ]
            }
        });

        if (existingLead) {
            console.log(`[Webhook] Duplicate lead detected: ${email || phone}`);
            // Optionally update the existing lead or just log activity
            await logActivity({
                leadId: existingLead.id,
                action: "WEBHOOK_DUPLICATE_HIT",
                metadata: { source, receivedData: req.body }
            });
            return res.status(200).json({ message: "Lead already exists", leadId: existingLead.id });
        }

        // Create Lead
        const newLead = await prisma.lead.create({
            data: {
                name,
                email,
                phone,
                source: leadSource,
                enquiryType: enquiryType || "SERVICES",
                score: 0,
                category: "Cold Lead"
            }
        });

        // Log Activity
        await logActivity({
            leadId: newLead.id,
            action: "LEAD_CREATED_VIA_WEBHOOK",
            metadata: { source, metadata }
        });

        // Auto-assign lead to rep with lowest load
        await routeLead(newLead.id);

        // ── AI Outbound Call Pipeline (fire-and-forget) ──────────────────────
        const { processNewLead } = require("../services/leadCallService");
        processNewLead(newLead).catch(err =>
            console.error("[CallPipeline] Failed to queue lead for auto-call:", err.message)
        );

        // Trigger welcome email (fire-and-forget)
        if (newLead.email) {
            emailService.sendLeadWelcomeEmail({ lead: newLead, workspaceId: newLead.workspaceId }).catch(() => { });
        }

        res.status(201).json({ message: "Lead processed successfully", leadId: newLead.id });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ message: "Error processing webhook", error: error.message });
    }
};

// Handle ZenVoice Agent Webhook (Collected Data from AI calls)
const handleZenVoiceAgentWebhook = async (req, res) => {
    try {
        console.log("ZenVoice Agent Webhook received:", JSON.stringify(req.body, null, 2));
        const collectedData = req.body.collectedData || {};
        const toolName = req.body.toolName || "ZenVoice";
        const room_name = req.body.room_name || req.body.callId || req.body.call_id || req.body.sessionId;
        const calledPhone = req.body.phoneNumber || req.body.to || req.body.toNumber || req.body.customerPhone || collectedData.phonenum;

        // ── Capture recording URL from ZenVoice and update callLog ────────────
        const recordingUrl = req.body.recording_url || req.body.recordingUrl || req.body.recording || null;
        const callDuration = req.body.duration || req.body.call_duration || null;
        if (room_name && (recordingUrl || callDuration)) {
            try {
                const callLog = await prisma.callLog.findFirst({
                    where: { OR: [{ sessionId: room_name }, { greeterCallId: room_name }] },
                    orderBy: { createdAt: "desc" },
                });
                if (callLog) {
                    await prisma.callLog.update({
                        where: { id: callLog.id },
                        data: {
                            callStatus: "COMPLETED",
                            ...(recordingUrl ? { recordingUrl: String(recordingUrl) } : {}),
                            ...(callDuration ? { duration: parseInt(callDuration) } : {}),
                        },
                    });
                    console.log(`[ZenVoice Webhook] Updated callLog ${callLog.id} — recording: ${recordingUrl || "none"}`);
                }
            } catch (clErr) {
                console.error("[ZenVoice Webhook] Failed to update callLog:", clErr.message);
            }
        }

        if (!room_name && !calledPhone) {
            return res.status(400).json({ message: "Invalid payload: room_name or phone number is required" });
        }

        // Try to find the lead associated with this call session
        let lead = null;

        // 1. Try by phonenum in collectedData if valid
        if (collectedData.phonenum && collectedData.phonenum !== "not available") {
            const cleanPhone = collectedData.phonenum.replace(/\D/g, "").slice(-10);
            lead = await prisma.lead.findFirst({
                where: { phone: { contains: cleanPhone } },
                select: { id: true, name: true, email: true, phone: true, workspaceId: true, score: true, scoreUpdated: true, tags: true, status: true, assignedToId: true }
            });
        }

        // 2. Try by session ID matching callLog.sessionId or callLog.greeterCallId
        if (!lead && room_name) {
            const callLog = await prisma.callLog.findFirst({
                where: { OR: [{ sessionId: room_name }, { greeterCallId: room_name }] },
                include: { lead: true }
            });
            if (callLog?.lead) {
                lead = await prisma.lead.findUnique({
                    where: { id: callLog.lead.id },
                    select: { id: true, name: true, email: true, phone: true, workspaceId: true, score: true, scoreUpdated: true, tags: true, status: true, assignedToId: true }
                });
            }
        }

        // 3. Fallback: match by toNumber in CallLog
        if (!lead && room_name) {
            const callLog = await prisma.callLog.findFirst({
                where: { sessionId: room_name },
                include: { lead: true }
            });
            if (callLog?.toNumber) {
                const cleanPhone = callLog.toNumber.replace(/\D/g, "").slice(-10);
                lead = await prisma.lead.findFirst({
                    where: { phone: { contains: cleanPhone } },
                    select: { id: true, name: true, email: true, phone: true, workspaceId: true, score: true, scoreUpdated: true, tags: true, status: true, assignedToId: true }
                });
            }
        }

        // 4. Last resort: match by calledPhone
        if (!lead && calledPhone) {
            const cleanPhone = calledPhone.replace(/\D/g, "").slice(-10);
            lead = await prisma.lead.findFirst({
                where: { phone: { contains: cleanPhone } },
                select: { id: true, name: true, email: true, phone: true, workspaceId: true, score: true, scoreUpdated: true, tags: true, status: true, assignedToId: true }
            });
            console.log(`[Webhook] Matched lead by calledPhone: ${calledPhone} → ${lead?.id || "not found"}`);
        }

        if (lead) {
            console.log("[Webhook] Processing lead:", lead);

            const updateFields = {};
            if (collectedData.name && collectedData.name !== "not available" && (!lead.name || lead.name === "New Lead")) {
                updateFields.name = collectedData.name;
            }

            // Always update score to 25 and status to CONVERTED upon call completion
            updateFields.status = "CONVERTED";
            updateFields.score = 25;
            updateFields.scoreUpdated = true;

            // Recalculate category based on score 25
            const { category } = calculateLeadScore({ ...lead, score: 25, scoreUpdated: true });
            updateFields.category = category;

            // Build updated tags list
            const currentTags = lead.tags || [];
            const newTags = [...currentTags];
            if (!newTags.includes("ai call qualified")) {
                newTags.push("ai call qualified");
            }
            if (category === "Warm" || category === "Hot" || category === "Warm Lead" || category === "Hot Lead") {
                if (!newTags.includes("ai qualified")) {
                    newTags.push("ai qualified");
                }
            }
            updateFields.tags = { set: newTags };

            const updatedLead = await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    ...updateFields,
                    notes: {
                        create: {
                            content: `[AI Call Completed - ${toolName || "ZenVoice"}]: ${JSON.stringify(collectedData)}`
                        }
                    }
                }
            });

            // Trigger routing if the lead is not assigned
            if (!lead.assignedToId) {
                await routeLead(lead.id);
            }

            await logActivity({
                leadId: lead.id,
                action: "AI_QUALIFIED",
                metadata: { toolName, collectedData, pointsAdded: 25 }
            });

            // Send CRM Brochure to lead email
            if (lead.email) {
                const company = await prisma.companySettings.findFirst({
                    where: { workspaceId: lead.workspaceId || undefined }
                });

                emailService.sendCRMBrochureEmail({
                    lead: updatedLead,
                    company,
                    workspaceId: lead.workspaceId
                }).catch(err => {
                    console.error("[Webhook] Failed to send CRM brochure email:", err.message);
                });
            }

            // Send CRM Brochure to lead WhatsApp
            if (lead.phone) {
                const path = require("path");
                const brochurePath = path.join(__dirname, "../../../frontend/src/assets/CRM broucher.pdf");
                const whatsappService = require("../services/whatsappService");

                whatsappService.sendWhatsAppMedia({
                    to: lead.phone,
                    filePath: brochurePath,
                    caption: `Hi ${updatedLead.name || lead.name || "there"}, following up on our conversation, here is our CRM brochure! Let us know if you have any questions.`
                }).catch(err => {
                    console.error("[Webhook] Failed to send follow-up WhatsApp brochure:", err.message);
                });
            }

            return res.status(200).json({ message: "Lead converted & scored", leadId: lead.id });
        }

        res.status(200).json({ message: "Data received, no lead matched" });
    } catch (error) {
        console.error("ZenVoice Webhook Error:", error);
        res.status(500).json({ message: "Error", error: error.message });
    }
};

// Handle Calendly Webhook
const handleCalendlyWebhook = async (req, res) => {
    try {
        const { event, payload } = req.body;

        if (event === 'invitee.created') {
            const email = payload.email;
            const name = payload.name;
            const startTime = payload.scheduled_event?.start_time;
            const meetLink = payload.scheduled_event?.location?.join_url || payload.scheduled_event?.location?.location || "No link provided";

            console.log(`[Calendly Webhook] Meeting scheduled by ${email}`);

            let lead = await prisma.lead.findFirst({ where: { email } });

            if (!lead) {
                // Create lead if not found
                lead = await prisma.lead.create({
                    data: {
                        name,
                        email,
                        source: "WEBSITE", // Or add CALENDLY to sources
                        status: "FOLLOW_UP",
                        enquiryType: "PRODUCT"
                    }
                });
            }

            // Log Activity
            await logActivity({
                leadId: lead.id,
                action: "CALENDLY_MEETING_SCHEDULED",
                metadata: { startTime, meetLink, eventName: payload.scheduled_event?.name }
            });

            // Update status
            await prisma.lead.update({
                where: { id: lead.id },
                data: { status: "FOLLOW_UP" }
            });

            // Create Task
            await prisma.task.create({
                data: {
                    title: `Calendly Meet: ${payload.scheduled_event?.name || 'Discussion'}`,
                    leadId: lead.id,
                    dueDate: new Date(startTime || Date.now()),
                    description: `Google Meet: ${meetLink}\nScheduled via Calendly`,
                    status: "PENDING",
                    priority: "HIGH"
                }
            });
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("Calendly Webhook Error:", error);
        res.status(200).send("OK"); // Respond OK to Calendly anyway to avoid retries on simple errors
    }
};

// ── VoiceLink Call Event Webhook ─────────────────────────────────────────────
// VoiceLink POSTs to /api/webhooks/voicelink-events on every call state change.
// Events: Initiated, Ringing, Connected, Hangup, Failed
const handleVoiceLinkCallEvent = async (req, res) => {
    try {
        res.status(200).json({ ok: true }); // Ack immediately

        const body = req.body || {};
        const callId = body.call_id ?? body.callId ?? body.session_id ?? body.uuid;
        if (!callId) return;

        // Normalise fields across different VoiceLink event shapes
        const from = body.from ?? body.caller ?? body.from_number ?? "";
        const to = body.to ?? body.callee ?? body.to_number ?? "";
        const did = body.did ?? body.did_number ?? body.phone_number ?? to;
        const rawStatus = (body.status ?? body.call_status ?? body.event ?? "").toString().toLowerCase();
        const duration = body.duration != null ? Number(body.duration) : undefined;
        const recUrl = body.recording_url ?? body.recording ?? body.record_url ?? null;

        // Map VoiceLink status → normalised status
        const STATUS_MAP = {
            initiated: "initiated", init: "initiated",
            ringing: "ringing", ring: "ringing",
            connected: "connected", answered: "connected", active: "connected",
            hangup: "hangup", hung_up: "hangup", ended: "hangup", completed: "hangup",
            failed: "failed", busy: "failed", "no-answer": "failed",
        };
        const status = STATUS_MAP[rawStatus] ?? rawStatus ?? "unknown";
        const direction = (body.direction ?? body.call_direction ?? "").toLowerCase() === "inbound"
            ? "inbound" : "outbound";

        // Find the workspace via the DID number
        let workspaceId = null;
        let userId = null;
        if (did) {
            const didRecord = await prisma.dIDNumber.findFirst({
                where: { number: did },
                include: { assignedToEmployee: { select: { id: true, workspaceId: true } } },
            });
            if (didRecord) {
                workspaceId = didRecord.assignedToEmployee?.workspaceId ?? null;
                userId = didRecord.assignedToEmployee?.id ?? null;
                // Fallback: look up workspace via superAdmin
                if (!workspaceId) {
                    const sa = await prisma.user.findUnique({
                        where: { id: didRecord.superAdminId },
                        select: { workspaceId: true },
                    });
                    workspaceId = sa?.workspaceId ?? null;
                }
            }
        }

        await prisma.zenCallEvent.upsert({
            where: { callId },
            update: {
                status,
                duration: duration ?? undefined,
                recordingUrl: recUrl ?? undefined,
                endedAt: (status === "hangup" || status === "failed") ? new Date() : undefined,
                updatedAt: new Date(),
            },
            create: {
                callId, from, to, direction, status, did,
                userId, workspaceId, duration: duration ?? null,
                recordingUrl: recUrl,
                startedAt: new Date(),
                rawPayload: body,
            },
        });

        // Retries if lead did not attend the outbound call
        if ((status === "hangup" || status === "failed") && direction === "outbound") {
            const callLog = await prisma.callLog.findFirst({
                where: { sessionId: callId },
                include: { lead: true }
            });

            if (callLog && callLog.lead) {
                const lead = callLog.lead;

                // Did the lead attend the call? (If attended, score is updated to 25)
                const wasAttended = lead.status === "CONVERTED" || lead.score >= 25;
                const isNoAnswer = status === "failed" || (status === "hangup" && (!duration || duration < 5));

                if (!wasAttended && isNoAnswer && lead.callRetryCount < 2) {
                    console.log(`[VoiceLink Webhook] Lead ${lead.name} did not attend the AI call. Triggering retry call (Attempt: ${lead.callRetryCount + 1})...`);

                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { callStatus: "queued" }
                    });

                    await logActivity({
                        leadId: lead.id,
                        action: "AI_CALL_RETRY_TRIGGERED",
                        metadata: { attempt: lead.callRetryCount + 1, prevCallId: callId, status }
                    });

                    const { enqueueCall, executeCallDirectly } = require("../queues/callQueue");
                    const { isRedisConnected } = require("../queues/redisConnection");

                    if (isRedisConnected()) {
                        await enqueueCall(lead.id, { priority: 3, delay: 30000 }); // delay 30s
                    } else {
                        setTimeout(async () => {
                            try {
                                await executeCallDirectly(lead.id);
                            } catch (err) {
                                console.error("[VoiceLink Webhook] Direct retry call failed:", err.message);
                            }
                        }, 30000); // retry direct call in 30s
                    }
                }
            }
        }
    } catch (err) {
        console.error("[ZenCall Webhook] Error processing call event:", err.message);
    }
};

// ── TeleCMI HTTP Web Flow ─────────────────────────────────────────────────────
// Called by TeleCMI when a client dials the workspace DID number.
// Must respond with routing JSON within ~3s or TeleCMI times out.
const handleTelecmiInbound = async (req, res) => {
    const { from, to, cmiuuid, appid } = req.body || {};

    try {
        const prisma = require("../utils/prisma");
        const { emitToWorkspace } = require("../utils/socketManager");

        // Find the workspace that owns this appid
        const zxRequest = await prisma.zXCallRequest.findFirst({
            where: { appId: String(appid), status: "ACTIVE" },
            select: { workspaceId: true, appId: true },
        });

        if (!zxRequest?.workspaceId) {
            // Unknown appid — respond with empty result so TeleCMI plays "no agents"
            return res.json({ code: 200, result: [] });
        }

        const workspaceId = zxRequest.workspaceId;

        // Get all active C2C agents for this workspace
        const agents = await prisma.user.findMany({
            where: { workspaceId, isC2C: true, isActive: true, telecmiAgentId: { not: null } },
            select: { id: true, telecmiAgentId: true, telecmiUserId: true, name: true },
        });

        if (!agents.length) {
            return res.json({ code: 200, result: [] });
        }

        // Normalise caller number — last 10 digits for lead lookup
        const fromStr = String(from || "").replace(/\D/g, "");
        const last10 = fromStr.slice(-10);

        // Try to match a lead by phone number in this workspace, and pull its
        // assigned sales rep so we can route the call straight to them.
        const lead = last10
            ? await prisma.lead.findFirst({
                  where: { phone: { endsWith: last10 }, workspaceId },
                  orderBy: { createdAt: "desc" },
                  select: {
                      id: true,
                      name: true,
                      assignedTo: {
                          select: { id: true, name: true, telecmiAgentId: true, isC2C: true, isActive: true },
                      },
                  },
              })
            : null;

        // The "correct sales user": the lead's assigned rep, but only if they are
        // an active, C2C-provisioned agent in this workspace (so they can take the
        // call). Otherwise we fall back to ringing everyone.
        const assignedRep =
            lead?.assignedTo &&
            lead.assignedTo.isActive &&
            lead.assignedTo.isC2C &&
            lead.assignedTo.telecmiAgentId &&
            agents.some((a) => a.id === lead.assignedTo.id)
                ? lead.assignedTo
                : null;

        // Log the inbound call — attribute it to the assigned rep when known.
        const callLog = await prisma.callLog.create({
            data: {
                callType: "INBOUND",
                callStatus: "RINGING",
                fromNumber: fromStr || String(from),
                toNumber: String(to || ""),
                cmiuuid: cmiuuid ? String(cmiuuid) : null,
                workspaceId,
                userId: assignedRep?.id || agents[0].id,
                leadId: lead?.id || null,
                duration: 0,
            },
        });

        // Notify all connected CRM users in this workspace
        emitToWorkspace(workspaceId, "inbound_call", {
            callLogId: callLog.id,
            from: fromStr || String(from),
            to: String(to || ""),
            cmiuuid: cmiuuid ? String(cmiuuid) : null,
            leadId: lead?.id || null,
            leadName: lead?.name || null,
            assignedRepId: assignedRep?.id || null,
            assignedRepName: assignedRep?.name || null,
        });

        // Build the ring order. With followme:true TeleCMI rings the agents
        // sequentially in array order, so we put the assigned rep FIRST and keep
        // the rest as fallback (no call is lost if the rep is unavailable).
        const orderedAgents = assignedRep
            ? [assignedRep, ...agents.filter((a) => a.id !== assignedRep.id)]
            : agents;
        const result = orderedAgents.map((a) => ({ agent_id: a.telecmiAgentId }));

        console.log(
            `[TeleCMI Inbound] from=${fromStr} → ${assignedRep ? `rep ${assignedRep.name} first, then ${agents.length - 1} others` : `all ${agents.length} agents (no assigned rep)`}`
        );

        return res.json({
            code: 200,
            loop: 2,
            followme: true,
            hangup: false,
            timeout: 20,
            result,
        });
    } catch (err) {
        console.error("[TeleCMI Inbound] Error:", err.message);
        // Still respond so TeleCMI doesn't hang
        return res.json({ code: 200, result: [] });
    }
};

// ── TeleCMI CDR Webhook ───────────────────────────────────────────────────────
// Called by TeleCMI when a call ends. Updates the CallLog with final status/duration.
const handleTelecmiCdr = async (req, res) => {
    try {
        const prisma = require("../utils/prisma");
        const { emitToWorkspace } = require("../utils/socketManager");

        // TeleCMI CDR fields (field names vary by version — handle both)
        const cmiuuid  = req.body?.cmiuuid  || req.body?.uuid   || req.body?.call_uuid;
        const status   = req.body?.status   || req.body?.hangup_cause || "COMPLETED";
        const duration = Number(req.body?.duration || req.body?.billsec || 0);

        if (!cmiuuid) return res.json({ received: true });

        const callLog = await prisma.callLog.findFirst({
            where: { cmiuuid: String(cmiuuid) },
            select: { id: true, workspaceId: true },
        });

        if (callLog) {
            const statusMap = {
                ANSWER: "ANSWERED", ANSWERED: "ANSWERED",
                "NO ANSWER": "MISSED", NOANSWER: "MISSED",
                BUSY: "MISSED", FAILED: "MISSED",
            };
            const callStatus = statusMap[String(status).toUpperCase()] || "COMPLETED";

            await prisma.callLog.update({
                where: { id: callLog.id },
                data: { callStatus, duration },
            });

            if (callLog.workspaceId) {
                emitToWorkspace(callLog.workspaceId, "inbound_call_ended", {
                    callLogId: callLog.id,
                    cmiuuid: String(cmiuuid),
                    callStatus,
                    duration,
                });
            }
        }

        return res.json({ received: true });
    } catch (err) {
        console.error("[TeleCMI CDR] Error:", err.message);
        return res.json({ received: true });
    }
};

module.exports = {
    handleLeadWebhook,
    handleZenVoiceAgentWebhook,
    handleCalendlyWebhook,
    handleVoiceLinkCallEvent,
    handleTelecmiInbound,
    handleTelecmiCdr,
};
