const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const FormData = require("form-data");
const axios = require("axios");

// Initiate Click2Call via Greeter
// leadId is optional — if omitted, we try to auto-match by phone number
const initiateCall = async (req, res) => {
    try {
        const { userId, workspaceId } = req.user;
        const { leadId: providedLeadId, customerNumber } = req.body;

        if (!customerNumber) {
            return res.status(400).json({ message: "customerNumber is required" });
        }

        // Auto-match lead by phone if leadId not provided
        let leadId = providedLeadId || null;
        if (!leadId) {
            const cleaned = customerNumber.replace(/\D/g, "").slice(-10);
            const matched = await prisma.lead.findFirst({
                where: { phone: { endsWith: cleaned }, workspaceId },
                select: { id: true },
            });
            leadId = matched?.id || null;
        } else {
            // Verify the provided lead belongs to this workspace
            const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId }, select: { id: true } });
            if (!lead) leadId = null;
        }

        // Get the agent's phone number
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.phone) {
            return res.status(400).json({ message: "Your phone number is not set. Please update your profile with your phone number." });
        }

        // Create a call log entry first (status: INITIATED)
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                userId,
                callType: "OUTBOUND",
                callStatus: "INITIATED",
                agentNumber: user.phone,
                duration: 0
            }
        });

        // Call Greeter Click2Call API
        const formData = new FormData();
        formData.append("user_id", process.env.GREETER_USER_ID);
        formData.append("customer_number", customerNumber);
        formData.append("agen_number", user.phone);
        formData.append("number", process.env.GREETER_NUMBER);
        formData.append("Customer_CRM_ID", leadId || callLog.id);

        const greeterResponse = await axios.post(
            process.env.GREETER_API_URL,
            formData,
            { headers: formData.getHeaders() }
        );

        // Update call log with greeter response if available
        if (greeterResponse.data) {
            await prisma.callLog.update({
                where: { id: callLog.id },
                data: {
                    greeterCallId: greeterResponse.data?.call_id?.toString() || null,
                    callStatus: "RINGING"
                }
            });
        }

        // Log activity only if linked to a lead
        if (leadId) {
            await logActivity({
                leadId,
                userId,
                action: "CALL_INITIATED",
                metadata: { callType: "OUTBOUND", customerNumber, callLogId: callLog.id }
            });
        }

        res.status(200).json({
            message: "Call initiated successfully",
            callLog,
            leadId,
            greeterResponse: greeterResponse.data
        });
    } catch (error) {
        console.error("Click2Call error:", error.message);
        res.status(500).json({ message: "Failed to initiate call", error: error.message });
    }
};

// Greeter Webhook - receives call data after call ends
// This endpoint is called by Greeter (no auth required)
const greeterWebhook = async (req, res) => {
    try {
        console.log("Greeter webhook received:", req.body);

        const {
            "call-duration": callDuration,
            "agent-number": agentNumber,
            "call-date": callDate,
            "call-recording": callRecording,
            "call-type": callType,
            "call-status": callStatus,
            "Customer_CRM_ID": customerCrmId,
            "customer_number": customerNumber
        } = req.body;

        // Try to find the matching call log
        let callLog = null;

        // First try by Customer_CRM_ID (leadId)
        if (customerCrmId) {
            callLog = await prisma.callLog.findFirst({
                where: {
                    leadId: customerCrmId,
                    callStatus: { in: ["INITIATED", "RINGING", "CONNECTED"] }
                },
                orderBy: { createdAt: "desc" }
            });
        }

        // Fallback: match by agent number
        if (!callLog && agentNumber) {
            callLog = await prisma.callLog.findFirst({
                where: {
                    agentNumber: { contains: agentNumber.replace(/^91/, "") },
                    callStatus: { in: ["INITIATED", "RINGING", "CONNECTED"] }
                },
                orderBy: { createdAt: "desc" }
            });
        }

        if (callLog) {
            // Update existing call log
            await prisma.callLog.update({
                where: { id: callLog.id },
                data: {
                    duration: parseInt(callDuration) || 0,
                    callStatus: callStatus || "COMPLETED",
                    recordingUrl: callRecording || null,
                    callDate: callDate ? new Date(callDate) : new Date(),
                    agentNumber: agentNumber || callLog.agentNumber
                }
            });

            // Log activity
            await logActivity({
                leadId: callLog.leadId,
                userId: callLog.userId,
                action: "CALL_COMPLETED",
                metadata: {
                    duration: parseInt(callDuration) || 0,
                    callStatus,
                    hasRecording: !!callRecording
                }
            });
        } else {
            // Create a new call log if no matching one found
            // Try to find lead by customer number
            let leadId = customerCrmId;
            if (!leadId && customerNumber) {
                const lead = await prisma.lead.findFirst({
                    where: { phone: { contains: customerNumber.replace(/^91/, "") } }
                });
                leadId = lead?.id;
            }

            if (leadId) {
                await prisma.callLog.create({
                    data: {
                        leadId,
                        userId: "system",
                        duration: parseInt(callDuration) || 0,
                        callType: callType || "OUTBOUND",
                        callStatus: callStatus || "COMPLETED",
                        recordingUrl: callRecording || null,
                        agentNumber: agentNumber || null,
                        callDate: callDate ? new Date(callDate) : new Date()
                    }
                });
            }
        }

        res.status(200).json({ message: "Webhook received successfully" });
    } catch (error) {
        console.error("Greeter webhook error:", error.message);
        res.status(500).json({ message: "Webhook processing error", error: error.message });
    }
};

// Log a manual call (existing functionality)
const logCall = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId, duration, callType, notes } = req.body;

        const callLog = await prisma.callLog.create({
            data: {
                userId,
                leadId,
                duration: parseInt(duration) || 0,
                callType: callType || "OUTBOUND",
                callStatus: "COMPLETED"
            }
        });

        if (notes) {
            await prisma.note.create({
                data: {
                    leadId,
                    content: `[Call Log - ${callType} - ${duration}s]: ${notes}`
                }
            });
        }

        await logActivity({
            leadId,
            userId,
            action: "CALL_LOGGED",
            metadata: { duration, callType }
        });

        res.status(201).json(callLog);
    } catch (error) {
        res.status(500).json({ message: "Error logging call", error: error.message });
    }
};

// Get call logs for a lead
const getCallLogs = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { leadId } = req.params;

        const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId }, select: { id: true } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const logs = await prisma.callLog.findMany({
            where: { leadId },
            orderBy: { createdAt: "desc" }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching call logs", error: error.message });
    }
};

// Transcribe a call recording
const transcribeCall = async (req, res) => {
    try {
        const { callLogId } = req.params;

        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId },
            include: { lead: { select: { workspaceId: true } } },
        });
        if (!callLog) {
            return res.status(404).json({ message: "Call log not found" });
        }

        if (!callLog.recordingUrl) {
            return res.status(400).json({ message: "No recording available for this call" });
        }

        if (callLog.isTranscribed) {
            return res.status(200).json({
                message: "Already transcribed",
                callLog
            });
        }

        const { transcribeFromUrl, transcribeFromFile } = require("../services/transcriptionService");
        const path = require("path");

        console.log(`Starting transcription for call ${callLogId}...`);
        console.log(`Recording URL: ${callLog.recordingUrl}`);

        let result;
        const storedUrl = callLog.recordingUrl;

        // ── Detect call source the same way streamRecording does ──────────────
        const zenvoiceFromLast10 = String(process.env.ZENVOICE_FROM_PHONE || "").replace(/\D/g, "").slice(-10);
        const agentLast10 = String(callLog.agentNumber || "").replace(/\D/g, "").slice(-10);
        const isAiCall = zenvoiceFromLast10 && agentLast10 && agentLast10 === zenvoiceFromLast10;

        if (storedUrl.startsWith("/uploads/")) {
            // Local uploaded file
            const localPath = path.join(__dirname, "../../", storedUrl);
            console.log(`Transcribing local file: ${localPath}`);
            result = await transcribeFromFile(localPath);

        } else if (isAiCall) {
            // ── PIOPIY / ZenVoice AI call recording ───────────────────────────
            if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
                // Full URL (e.g. from ZenVoice webhook) — download directly
                console.log(`Downloading ZenVoice recording: ${storedUrl}`);
                result = await transcribeFromUrl(storedUrl);
            } else {
                // PIOPIY filename — needs Bearer auth
                const piopiyKey = process.env.PIOPIY_API_KEY;
                if (!piopiyKey) {
                    return res.status(502).json({ message: "PIOPIY_API_KEY not configured in backend/.env" });
                }
                const downloadUrl = `https://api.piopiy.com/sip/app/call/recording/play/${encodeURIComponent(storedUrl)}`;
                console.log(`Downloading PIOPIY recording: ${downloadUrl}`);
                result = await transcribeFromUrl(downloadUrl, { Authorization: `Bearer ${piopiyKey}` });
            }

        } else if (!storedUrl.startsWith("http") || storedUrl.includes("recordings.telecmi.com")) {
            // ── TeleCMI filename (raw filename or old NXDOMAIN URL) ────────────
            const { getWorkspaceTelecmiCreds } = require("../services/telecmiService");
            const creds = callLog.lead?.workspaceId
                ? await getWorkspaceTelecmiCreds(callLog.lead.workspaceId)
                : null;

            let filename = storedUrl;
            if (filename.startsWith("http")) {
                const m = filename.match(/\/([^/]+)$/);
                filename = m?.[1] || null;
            }

            if (!creds?.appid || !creds?.secret || !filename) {
                return res.status(502).json({ message: "Cannot resolve TeleCMI recording — missing credentials or filename" });
            }

            const downloadUrl = `https://rest.telecmi.com/v2/play?appid=${creds.appid}&secret=${creds.secret}&file=${encodeURIComponent(filename)}`;
            console.log(`Downloading TeleCMI recording: ${downloadUrl}`);
            result = await transcribeFromUrl(downloadUrl);

        } else {
            // Direct HTTP URL from another provider
            console.log(`Downloading recording: ${storedUrl}`);
            result = await transcribeFromUrl(storedUrl);
        }

        const updated = await prisma.callLog.update({
            where: { id: callLogId },
            data: {
                transcription: result.transcription,
                plainText: result.plainText,
                summary: result.summary,
                tone: result.tone,
                urgency: result.urgency,
                emotion: result.emotion,
                callCategory: result.category,
                sentiment: result.sentiment,
                feedback: result.feedback,
                conclusion: result.conclusion,
                isTranscribed: true,
                transcribedAt: new Date(),
                duration: result.duration || callLog.duration
            }
        });

        // Apply call scoring to the lead if transcript exists and scoring config is set
        let callScore = 0;
        let scoreBreakdown = [];
        let updatedLeadScore = null;
        if (callLog.leadId && result.plainText) {
            try {
                const { scoreCallConversation } = require("../services/transcriptionService");
                const calculateLeadScore = require("../utils/leadScorer");
                const workspaceId = callLog.lead?.workspaceId;
                const settings = workspaceId
                    ? await prisma.companySettings.findFirst({ where: { workspaceId } })
                    : null;
                const scoringParams = settings?.callScoringConfig || [];
                if (scoringParams.length > 0) {
                    const scored = await scoreCallConversation(result.plainText, scoringParams);
                    callScore = scored.callScore;
                    scoreBreakdown = scored.scoreBreakdown;
                    if (callScore > 0) {
                        const lead = await prisma.lead.findUnique({ where: { id: callLog.leadId }, select: { score: true, status: true } });
                        if (lead && lead.status !== "CONVERTED") {
                            const newScore = Math.min((lead.score || 0) + callScore, 99);
                            const { category } = calculateLeadScore({ score: newScore, scoreUpdated: true });
                            await prisma.lead.update({
                                where: { id: callLog.leadId },
                                data: { score: newScore, scoreUpdated: true, category },
                            });
                            updatedLeadScore = newScore;
                        }
                    }
                }
            } catch (scoringErr) {
                console.error("[TranscribeCall] Scoring error (non-fatal):", scoringErr.message);
            }
        }

        // Log activity
        await logActivity({
            leadId: callLog.leadId,
            userId: req.user.userId,
            action: "CALL_TRANSCRIBED",
            metadata: {
                callLogId,
                tone: result.tone,
                sentiment: result.sentiment,
                category: result.category,
                callScore,
                updatedLeadScore,
            }
        });

        res.status(200).json({
            message: "Transcription complete",
            callLog: updated,
            callScore,
            scoreBreakdown,
            updatedLeadScore,
        });
    } catch (error) {
        console.error("Transcription error:", error.message);
        res.status(500).json({ message: "Transcription failed", error: error.message });
    }
};

// Get all call logs for a lead (with full details)
const getCallLogDetails = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { callLogId } = req.params;
        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId },
            include: { lead: { select: { name: true, phone: true, workspaceId: true } } }
        });
        if (!callLog) return res.status(404).json({ message: "Call log not found" });
        if (callLog.lead && callLog.lead.workspaceId !== workspaceId) {
            return res.status(404).json({ message: "Call log not found" });
        }
        res.json(callLog);
    } catch (error) {
        res.status(500).json({ message: "Error fetching call log", error: error.message });
    }
};

// Upload a recording file manually for a lead
const uploadRecording = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId } = req.body;

        if (!leadId) {
            return res.status(400).json({ message: "leadId is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No recording file uploaded" });
        }

        const { workspaceId } = req.user;
        const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // Build the recording URL
        const recordingUrl = `/uploads/recordings/${req.file.filename}`;

        // Create a completed call log with the recording
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                userId,
                callType: "OUTBOUND",
                callStatus: "COMPLETED",
                agentNumber: "Manual Upload",
                duration: 0,
                recordingUrl,
                callDate: new Date()
            }
        });

        // Log activity
        await logActivity({
            leadId,
            userId,
            action: "RECORDING_UPLOADED",
            metadata: { callLogId: callLog.id, fileName: req.file.originalname }
        });

        res.status(201).json({
            message: "Recording uploaded successfully",
            callLog
        });
    } catch (error) {
        console.error("Upload recording error:", error.message);
        res.status(500).json({ message: "Failed to upload recording", error: error.message });
    }
};

// Upload an audio file and immediately transcribe it (combined workflow)
const uploadAndTranscribe = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId } = req.body;

        if (!leadId) {
            return res.status(400).json({ message: "leadId is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No audio file uploaded" });
        }

        const { workspaceId } = req.user;
        const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        const recordingUrl = `/uploads/recordings/${req.file.filename}`;
        const filePath = req.file.path;

        // Create call log immediately so we have an ID
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                userId,
                callType: "OUTBOUND",
                callStatus: "COMPLETED",
                recordingUrl,
                callDate: new Date(),
                duration: 0,
            }
        });

        console.log(`Starting transcription for uploaded file: ${req.file.originalname}`);

        const { transcribeFromFile } = require("../services/transcriptionService");
        const result = await transcribeFromFile(filePath);

        const updated = await prisma.callLog.update({
            where: { id: callLog.id },
            data: {
                transcription: result.transcription,
                plainText: result.plainText,
                summary: result.summary,
                tone: result.tone,
                urgency: result.urgency,
                emotion: result.emotion,
                callCategory: result.category,
                sentiment: result.sentiment,
                feedback: result.feedback,
                conclusion: result.conclusion,
                isTranscribed: true,
                transcribedAt: new Date(),
                duration: result.duration || 0,
            }
        });

        await logActivity({
            leadId,
            userId,
            action: "CALL_TRANSCRIBED",
            metadata: {
                callLogId: callLog.id,
                fileName: req.file.originalname,
                tone: result.tone,
                sentiment: result.sentiment,
                category: result.category,
            }
        });

        res.status(201).json({
            message: "Upload and transcription complete",
            callLog: updated,
        });
    } catch (error) {
        console.error("Upload-and-transcribe error:", error.message);
        res.status(500).json({ message: "Upload and transcription failed", error: error.message });
    }
};

// TeleCMI CDR Webhook — called by TeleCMI after every call ends (no auth, public)
// TeleCMI sends TWO CDRs per call: leg "a" (agent side) and leg "b" (customer side).
// Only leg "b" carries the customer's number and the recording filename.
const telecmiCdrWebhook = async (req, res) => {
    try {
        const {
            leg,
            user:       agentId,    // "1000_33338120"
            to,                     // numeric destination, e.g. 919976533301
            status,                 // "answered" | "no-answer" | "busy" | "failed"
            answeredsec,            // call duration in seconds
            filename,               // recording filename — only present on leg "b"
            appid,                  // TeleCMI app id (used to build recording URL)
            cmiuuid,
            time,                   // epoch ms
            direction,
        } = req.body;

        // Log full CDR payload for debugging recording URL discovery
        console.log("[TeleCMI CDR] FULL PAYLOAD:", JSON.stringify(req.body, null, 2));

        // Leg "a" (agent side) never carries a recording — skip it to avoid
        // marking the INITIATED log as COMPLETED before leg "b" can match it.
        if (leg === "a") return res.status(200).json({ message: "CDR received" });

        // Normalise destination to last-10 digits for DB matching
        const toDigits = String(to || "").replace(/\D/g, "");
        const toLast10 = toDigits.slice(-10);

        if (!toLast10) return res.status(200).json({ message: "CDR received" });

        // Store just the raw filename from TeleCMI. The correct download endpoint
        // is rest.telecmi.com/v2/play?appid=...&secret=...&file=<filename>
        // We build that URL at proxy time (streamRecording) using stored credentials.
        const recordingUrl = filename ? String(filename) : null;

        const duration   = parseInt(answeredsec) || 0;
        const callStatus = status === "answered"  ? "COMPLETED"
                         : status === "no-answer" ? "NO_ANSWER"
                         : status === "busy"       ? "BUSY"
                         : "FAILED";
        const callDate   = time ? new Date(Number(time)) : new Date();

        // Resolve TeleCMI agentId ("1000_33338120") → CRM user
        let resolvedUserId = null;
        if (agentId) {
            const crmUser = await prisma.user.findFirst({
                where: { telecmiAgentId: agentId },
                select: { id: true },
            });
            resolvedUserId = crmUser?.id || null;
        }

        // Match the INITIATED log created when click2call was triggered
        let callLog = null;
        if (agentId && toLast10) {
            callLog = await prisma.callLog.findFirst({
                where: { agentNumber: agentId, toNumber: { endsWith: toLast10 }, callStatus: "INITIATED" },
                orderBy: { createdAt: "desc" },
            });
        }
        if (!callLog && toLast10) {
            callLog = await prisma.callLog.findFirst({
                where: { toNumber: { endsWith: toLast10 }, callStatus: "INITIATED" },
                orderBy: { createdAt: "desc" },
            });
        }

        const updateData = {
            duration, callStatus, callDate,
            greeterCallId: cmiuuid || null,
            // Only set recordingUrl if this CDR actually has one (leg "b" only)
            ...(recordingUrl ? { recordingUrl } : {}),
        };

        if (callLog) {
            await prisma.callLog.update({ where: { id: callLog.id }, data: updateData });
            if (callLog.leadId) {
                await logActivity({
                    leadId: callLog.leadId,
                    userId: callLog.userId,
                    action: "CALL_COMPLETED",
                    metadata: { duration, callStatus, hasRecording: !!recordingUrl, leg },
                });
            }
        } else if (leg === "b") {
            // No pending log — create one directly from leg "b" (customer leg)
            const lead = await prisma.lead.findFirst({
                where: { phone: { endsWith: toLast10 } },
                orderBy: { createdAt: "desc" },
                select: { id: true },
            });
            if (lead?.id) {
                await prisma.callLog.create({
                    data: {
                        leadId:      lead.id,
                        userId:      resolvedUserId || "system",
                        callType:    direction === "outbound" ? "OUTBOUND" : "INBOUND",
                        agentNumber: agentId  || null,
                        toNumber:    toDigits || null,
                        ...updateData,
                    },
                });
                await logActivity({
                    leadId: lead.id,
                    userId: resolvedUserId || "system",
                    action: "CALL_COMPLETED",
                    metadata: { duration, callStatus, hasRecording: !!recordingUrl },
                });
            }
        }

        return res.status(200).json({ message: "CDR received" });
    } catch (error) {
        console.error("[TeleCMI] CDR webhook error:", error.message);
        return res.status(500).json({ message: "CDR processing error" });
    }
};

// Proxy a call recording back to the browser.
// Detects AI (PIOPIY/ZenVoice) calls vs TeleCMI calls by agentNumber and routes to correct source.
const streamRecording = async (req, res) => {
    try {
        const { callLogId } = req.params;
        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId },
            include: { lead: { select: { workspaceId: true } } },
        });
        if (!callLog?.recordingUrl) {
            return res.status(404).json({ message: "No recording for this call" });
        }

        // ── PIOPIY / ZenVoice AI call recordings ──────────────────────────────
        const zenvoiceFromLast10 = String(process.env.ZENVOICE_FROM_PHONE || "").replace(/\D/g, "").slice(-10);
        const agentLast10 = String(callLog.agentNumber || "").replace(/\D/g, "").slice(-10);
        const isAiCall = zenvoiceFromLast10 && agentLast10 && agentLast10 === zenvoiceFromLast10;

        if (isAiCall) {
            const storedUrl = callLog.recordingUrl;

            // If the stored value is already a full URL (from ZenVoice webhook), proxy it directly
            if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
                console.log("[streamRecording] ZenVoice direct URL:", storedUrl);
                try {
                    const resp = await axios.get(storedUrl, {
                        responseType: "stream",
                        timeout: 20000,
                        validateStatus: () => true,
                    });
                    if (resp.status !== 200) {
                        console.error("[streamRecording] ZenVoice recording returned:", resp.status);
                        return res.status(502).json({ message: "Recording not available from ZenVoice" });
                    }
                    res.setHeader("Content-Type", resp.headers["content-type"] || "audio/wav");
                    res.setHeader("Content-Disposition", "inline");
                    res.setHeader("Accept-Ranges", "bytes");
                    if (resp.headers["content-length"]) res.setHeader("Content-Length", resp.headers["content-length"]);
                    return resp.data.pipe(res);
                } catch (err) {
                    console.error("[streamRecording] ZenVoice fetch error:", err.message);
                    return res.status(502).json({ message: "Failed to stream ZenVoice recording" });
                }
            }

            // Otherwise treat it as a PIOPIY filename
            const piopiyKey = process.env.PIOPIY_API_KEY;
            if (!piopiyKey) {
                return res.status(502).json({ message: "PIOPIY_API_KEY not configured — add it to backend/.env" });
            }
            const recordingFetchUrl = `https://api.piopiy.com/sip/app/call/recording/play/${encodeURIComponent(storedUrl)}`;
            console.log("[streamRecording] PIOPIY fetch:", recordingFetchUrl);
            try {
                const resp = await axios.get(recordingFetchUrl, {
                    responseType: "stream",
                    timeout: 20000,
                    headers: { Authorization: `Bearer ${piopiyKey}` },
                    validateStatus: () => true,
                });
                if (resp.status !== 200) {
                    console.error("[streamRecording] PIOPIY returned:", resp.status);
                    return res.status(502).json({ message: "Recording not available from PIOPIY" });
                }
                res.setHeader("Content-Type", resp.headers["content-type"] || "audio/wav");
                res.setHeader("Content-Disposition", "inline");
                res.setHeader("Accept-Ranges", "bytes");
                if (resp.headers["content-length"]) res.setHeader("Content-Length", resp.headers["content-length"]);
                return resp.data.pipe(res);
            } catch (err) {
                console.error("[streamRecording] PIOPIY fetch error:", err.message);
                return res.status(502).json({ message: "Failed to stream PIOPIY recording" });
            }
        }

        // ── TeleCMI recordings (fallthrough) ──────────────────────────────────
        const { getWorkspaceTelecmiCreds } = require("../services/telecmiService");
        const workspaceId = callLog.lead?.workspaceId;
        const creds = workspaceId ? await getWorkspaceTelecmiCreds(workspaceId) : null;

        // Resolve filename from stored value.
        // New format: raw filename string (e.g. "33338120_abc.wav")
        // Legacy format: "https://recordings.telecmi.com/{appid}/{filename}"
        let filename = callLog.recordingUrl;
        if (filename.startsWith("http")) {
            const match = filename.match(/\/([^/]+)$/);
            filename = match?.[1] || null;
        }

        if (!filename || !creds?.appid || !creds?.secret) {
            return res.status(502).json({ message: "Recording not available from provider" });
        }

        // Correct TeleCMI recording download endpoint (v2/play)
        const recordingFetchUrl = `https://rest.telecmi.com/v2/play?appid=${creds.appid}&secret=${creds.secret}&file=${encodeURIComponent(filename)}`;
        console.log("[streamRecording] fetching:", recordingFetchUrl);

        let upstream = null;
        try {
            const resp = await axios.get(recordingFetchUrl, {
                responseType: "stream",
                timeout: 20000,
                validateStatus: () => true,
            });
            if (resp.status === 200) {
                upstream = resp;
            } else {
                console.error("[streamRecording] TeleCMI returned status:", resp.status);
            }
        } catch (err) {
            console.error("[streamRecording] fetch error:", err.message);
        }

        if (!upstream) {
            return res.status(502).json({ message: "Recording not available from provider" });
        }

        res.setHeader("Content-Type", upstream.headers["content-type"] || "audio/mpeg");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Accept-Ranges", "bytes");
        if (upstream.headers["content-length"]) {
            res.setHeader("Content-Length", upstream.headers["content-length"]);
        }
        upstream.data.pipe(res);
    } catch (error) {
        console.error("[streamRecording] error:", error.message);
        res.status(500).json({ message: "Failed to stream recording" });
    }
};

// PIOPIY CDR Webhook — receives call detail records for ZenVoice AI calls
// Handles PIOPIY's native field names: uuid, caller_id, did_number, status (ANSWER/NOANSWER/BUSY/FAILED),
// duration, recording, direction, timestamp
// Also handles TeleCMI-style fields as fallback: leg, to, answeredsec, filename, cmiuuid, time
const piopiyCdrWebhook = async (req, res) => {
    try {
        const body = req.body;
        console.log("[PIOPIY CDR] Payload:", JSON.stringify(body, null, 2));

        // Skip leg "a" if TeleCMI-style legs are used
        if (body.leg === "a") return res.status(200).json({ message: "CDR received" });

        // ── Normalise field names (PIOPIY native vs TeleCMI fallback) ──────────
        // Destination phone — PIOPIY: did_number | TeleCMI: to
        const rawTo    = body.did_number || body.to || body.destination || body.callee || "";
        // Caller / agent — PIOPIY: caller_id | TeleCMI: user
        const agentId  = body.caller_id  || body.from || body.user || null;
        // Status — PIOPIY: ANSWER/NOANSWER/BUSY/FAILED | TeleCMI: answered/no-answer/busy
        const rawStatus = String(body.status || body.call_status || "").toUpperCase();
        // Duration — PIOPIY: duration | TeleCMI: answeredsec
        const duration  = parseInt(body.duration ?? body.answeredsec ?? 0) || 0;
        // Recording — PIOPIY: recording | TeleCMI: filename
        const recordingUrl = body.recording || body.recording_url || body.filename || null;
        // Call UUID — PIOPIY: uuid | TeleCMI: cmiuuid
        const callUuid  = body.uuid || body.call_uuid || body.cmiuuid || null;
        // Timestamp — PIOPIY: timestamp (ms epoch) | TeleCMI: time
        const rawTime   = body.timestamp || body.start_time || body.time || null;
        const callDate  = rawTime ? new Date(Number(rawTime)) : new Date();
        const direction = body.direction || "outbound";

        const callStatus = (rawStatus === "ANSWER"   || rawStatus === "ANSWERED")  ? "COMPLETED"
                         : (rawStatus === "NOANSWER" || rawStatus === "NO-ANSWER" || rawStatus === "NO_ANSWER") ? "NO_ANSWER"
                         : rawStatus === "BUSY"   ? "BUSY"
                         : rawStatus === "FAILED" ? "FAILED"
                         : "FAILED";

        const toDigits = String(rawTo).replace(/\D/g, "");
        const toLast10 = toDigits.slice(-10);
        if (!toLast10) {
            console.warn("[PIOPIY CDR] Could not extract destination number — skipping");
            return res.status(200).json({ message: "CDR received" });
        }

        const zenvoiceFromLast10 = String(process.env.ZENVOICE_FROM_PHONE || "").replace(/\D/g, "").slice(-10);

        // Primary match: agentNumber = ZENVOICE_FROM_PHONE + toNumber + INITIATED
        let callLog = await prisma.callLog.findFirst({
            where: {
                toNumber: { endsWith: toLast10 },
                agentNumber: { endsWith: zenvoiceFromLast10 },
                callStatus: "INITIATED",
            },
            orderBy: { createdAt: "desc" },
        });

        // Fallback: any INITIATED log for this destination phone
        if (!callLog) {
            callLog = await prisma.callLog.findFirst({
                where: { toNumber: { endsWith: toLast10 }, callStatus: "INITIATED" },
                orderBy: { createdAt: "desc" },
            });
        }

        const updateData = {
            duration, callStatus, callDate,
            greeterCallId: callUuid,
            ...(recordingUrl ? { recordingUrl: String(recordingUrl) } : {}),
        };

        if (callLog) {
            await prisma.callLog.update({ where: { id: callLog.id }, data: updateData });
            if (callLog.leadId) {
                await logActivity({
                    leadId: callLog.leadId,
                    userId: callLog.userId,
                    action: "AI_CALL_COMPLETED",
                    metadata: { duration, callStatus, hasRecording: !!recordingUrl },
                });
            }
            console.log(`[PIOPIY CDR] Updated callLog ${callLog.id} — status: ${callStatus}, recording: ${recordingUrl || "none"}`);
        } else {
            // No pending log — create one linked to the matching lead
            const lead = await prisma.lead.findFirst({
                where: { phone: { endsWith: toLast10 } },
                orderBy: { createdAt: "desc" },
                select: { id: true },
            });
            if (lead?.id) {
                await prisma.callLog.create({
                    data: {
                        leadId:      lead.id,
                        userId:      "system",
                        callType:    direction === "outbound" ? "OUTBOUND" : "INBOUND",
                        agentNumber: agentId ? String(agentId) : null,
                        toNumber:    toDigits || null,
                        ...updateData,
                    },
                });
                console.log(`[PIOPIY CDR] Created new callLog for lead ${lead.id}`);
            } else {
                console.warn(`[PIOPIY CDR] No lead found for phone ending in ${toLast10}`);
            }
        }

        return res.status(200).json({ message: "CDR received" });
    } catch (error) {
        console.error("[PIOPIY CDR] webhook error:", error.message);
        return res.status(500).json({ message: "CDR processing error" });
    }
};

// Register PIOPIY CDR webhook — one-time setup using PIOPIY_API_KEY from .env
const registerPiopiyWebhook = async (req, res) => {
    try {
        const apiKey = process.env.PIOPIY_API_KEY;
        if (!apiKey) return res.status(400).json({ message: "PIOPIY_API_KEY not set in .env" });

        const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
        const cdrUrl = `${backendUrl}/api/calls/piopiy-cdr`;

        const axios = require("axios");
        const response = await axios.post("https://api.piopiy.com/webhook/add", {
            type: "cdr",
            method: "POST",
            url: cdrUrl,
            custom: "zenx_crm_ai_calls",
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            timeout: 10000,
        });

        console.log(`[PIOPIY] CDR webhook registered → ${cdrUrl}`);
        res.json({ message: "PIOPIY CDR webhook registered successfully", url: cdrUrl, response: response.data });
    } catch (error) {
        const msg = error.response?.data || error.message;
        console.error("[PIOPIY] Webhook registration failed:", msg);
        res.status(500).json({ message: "Failed to register webhook", error: msg });
    }
};

// Sync INITIATED AI callLogs with ZenVoice call-logs API
const syncZenVoiceCallLogs = async (req, res) => {
    try {
        const { syncCallLogs } = require("../services/zenvoiceService");
        const updated = await syncCallLogs();
        res.json({ message: `Synced ${updated} call log(s) from ZenVoice`, updated });
    } catch (error) {
        console.error("[ZenVoice Sync] Error:", error.message);
        res.status(500).json({ message: "Sync failed", error: error.message });
    }
};

module.exports = { initiateCall, greeterWebhook, telecmiCdrWebhook, piopiyCdrWebhook, registerPiopiyWebhook, logCall, getCallLogs, transcribeCall, getCallLogDetails, uploadRecording, uploadAndTranscribe, streamRecording, syncZenVoiceCallLogs };
