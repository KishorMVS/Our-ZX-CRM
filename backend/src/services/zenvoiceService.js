/**
 * ZenVoice API Service
 * Handles authentication via /auth/signin and API calls to ZenVoice platform.
 * - Auto-authenticates using email/password
 * - Caches JWT token and automatically refreshes it on 401
 * - Fetches + caches assistant list
 * - Makes outbound calls via make_call endpoint
 */
const axios = require("axios");

const ZENVOICE_BASE_URL = process.env.ZENVOICE_BASE_URL || "https://voice.zenxai.io/api/v1";

// ── Auth Token Management ───────────────────────────────────────────────────
let cachedToken = null;

/**
 * Sign in to ZenVoice using credentials from .env.
 */
const signIn = async () => {
    const email = process.env.ZENVOICE_EMAIL;
    const password = process.env.ZENVOICE_PASSWORD;

    if (!email || !password) {
        throw new Error("[ZenVoice] ZENVOICE_EMAIL and ZENVOICE_PASSWORD must be set in .env");
    }

    try {
        const response = await axios.post(`${ZENVOICE_BASE_URL}/auth/signin`, {
            email,
            password,
        }, { timeout: 15000 });

        const token = response.data?.data?.token || response.data?.token;
        if (!token) {
            throw new Error("No token returned in ZenVoice signin response");
        }

        cachedToken = token;
        console.log("[ZenVoice] Successfully authenticated and acquired JWT token");
        return cachedToken;
    } catch (err) {
        console.error("[ZenVoice] Sign-in failed:", err?.response?.data || err.message);
        throw err;
    }
};

/**
 * Get HTTP headers with Authorization token.
 */
const getHeaders = async (forceRefresh = false) => {
    if (forceRefresh || !cachedToken) {
        await signIn();
    }
    return {
        Authorization: `Bearer ${cachedToken}`,
        "Content-Type": "application/json",
    };
};

/**
 * Helper to perform authorized HTTP requests with automatic token refresh on 401.
 */
const requestWithAuth = async (method, url, data = null) => {
    let headers = await getHeaders();
    try {
        if (method === "get") {
            const response = await axios.get(url, { headers, timeout: 30000 });
            return response.data;
        } else {
            const response = await axios.post(url, data, { headers, timeout: 30000 });
            return response.data;
        }
    } catch (err) {
        if (err?.response?.status === 401) {
            console.warn("[ZenVoice] Token unauthorized (401). Attempting fresh sign-in...");
            try {
                headers = await getHeaders(true); // Force signin refresh
                if (method === "get") {
                    const response = await axios.get(url, { headers, timeout: 30000 });
                    return response.data;
                } else {
                    const response = await axios.post(url, data, { headers, timeout: 30000 });
                    return response.data;
                }
            } catch (retryErr) {
                console.error("[ZenVoice] Retry after sign-in failed:", retryErr?.response?.data || retryErr.message);
                throw retryErr;
            }
        }
        throw err;
    }
};

// ── Assistant Cache ──────────────────────────────────────────────────────────
let cachedAssistants = [];
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch all assistants from ZenVoice account.
 * Results are cached for 1 hour.
 * @param {boolean} forceRefresh - bypass cache
 * @returns {Array} List of assistant objects { id, name, ... }
 */
const fetchAssistants = async (forceRefresh = false) => {
    const now = Date.now();

    if (!forceRefresh && cachedAssistants.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
        return cachedAssistants;
    }

    try {
        const data = await requestWithAuth("get", `${ZENVOICE_BASE_URL}/assistants`);
        const assistants = data?.data || data?.assistants || data;
        cachedAssistants = Array.isArray(assistants) ? assistants : [];
        lastFetchTime = now;

        console.log(`[ZenVoice] Fetched ${cachedAssistants.length} assistant(s):`,
            cachedAssistants.map(a => `${a.name || a.title} (${a.id})`).join(", ")
        );

        return cachedAssistants;
    } catch (err) {
        console.error("[ZenVoice] Failed to fetch assistants:", err?.response?.data || err.message);
        // Return stale cache if available
        if (cachedAssistants.length > 0) {
            console.warn("[ZenVoice] Using stale assistant cache");
            return cachedAssistants;
        }
        throw err;
    }
};

/**
 * Make an outbound call via ZenVoice API.
 * @param {Object} payload - { phoneNumber, fromPhoneNumber, selectedAssistant, metadata }
 * @returns {Object} ZenVoice API response data
 */
const makeCall = async (payload) => {
    try {
        const data = await requestWithAuth("post", `${ZENVOICE_BASE_URL}/phone/make_call`, payload);
        console.log(`[ZenVoice] Call initiated: ${payload.phoneNumber} → assistant: ${payload.selectedAssistant}`);
        return data;
    } catch (err) {
        const status = err?.response?.status;
        const message = err?.response?.data?.message || err.message;

        console.error(`[ZenVoice] make_call failed (${status}): ${message}`);

        // Throw with useful info for BullMQ retry logic
        const error = new Error(`ZenVoice API error (${status}): ${message}`);
        error.statusCode = status;
        error.retryable = status >= 500 || status === 429 || !status; // Retry on server errors, rate limits, network errors
        throw error;
    }
};

/**
 * Sync ZenVoice call logs → update INITIATED CRM callLogs with real status/duration.
 * Matches by sessionId (room_name from make_call response) or customerPhone + date window.
 * Returns the number of callLogs updated.
 */
const syncCallLogs = async () => {
    const prisma = require("../utils/prisma");

    // Fetch last 48h of ZenVoice call logs (enough to cover any backlog)
    const data = await requestWithAuth("get", `${ZENVOICE_BASE_URL}/call-logs?limit=100`);
    const zenLogs = Array.isArray(data?.data) ? data.data : [];
    if (!zenLogs.length) return 0;

    // Find all INITIATED AI call logs in the CRM (from the last 48h)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const fromPhone = String(process.env.ZENVOICE_FROM_PHONE || "").replace(/\D/g, "").slice(-10);
    const initiatedLogs = await prisma.callLog.findMany({
        where: {
            callStatus: "INITIATED",
            agentNumber: { endsWith: fromPhone },
            createdAt: { gte: cutoff },
        },
    });
    if (!initiatedLogs.length) return 0;

    let updated = 0;
    for (const crmLog of initiatedLogs) {
        const crmPhone = String(crmLog.toNumber || "").replace(/\D/g, "").slice(-10);
        const crmSession = crmLog.sessionId || "";

        // Match by sessionId first, then fall back to phone + date proximity (±5 min)
        const match = zenLogs.find((z) => {
            if (crmSession && z.sessionId && z.sessionId === crmSession) return true;
            const zenPhone = String(z.customerPhone || "").replace(/\D/g, "").slice(-10);
            if (zenPhone !== crmPhone) return false;
            const diff = Math.abs(new Date(z.startTime).getTime() - new Date(crmLog.callDate || crmLog.createdAt).getTime());
            return diff < 5 * 60 * 1000; // within 5 minutes
        });

        if (!match) continue;

        const rawStatus = String(match.callStatus || "").toLowerCase();
        const callStatus = (rawStatus === "answered" || rawStatus === "success") ? "COMPLETED"
                         : (rawStatus === "noanswer" || rawStatus === "no answer" || rawStatus === "missed") ? "NO_ANSWER"
                         : rawStatus === "busy" ? "BUSY"
                         : rawStatus === "failed" ? "FAILED"
                         : null;

        if (!callStatus) continue;

        // Parse duration "MM:SS" → seconds
        let duration = 0;
        if (match.duration) {
            const parts = String(match.duration).split(":").map(Number);
            duration = parts.length === 2 ? parts[0] * 60 + parts[1] : parseInt(match.duration) || 0;
        }

        await prisma.callLog.update({
            where: { id: crmLog.id },
            data: {
                callStatus,
                duration,
                greeterCallId: match.id || crmLog.greeterCallId,
            },
        });
        updated++;
        console.log(`[ZenVoice Sync] callLog ${crmLog.id} → ${callStatus} (${duration}s)`);
    }

    return updated;
};

/**
 * Pull PIOPIY CDR records for recent calls and update CRM callLogs with
 * recording filenames and final status.
 * Requires PIOPIY_API_KEY (bearer token) and PIOPIY_APP_ID in .env.
 */
const syncPiopiyCDR = async () => {
    const prisma = require("../utils/prisma");
    const axios = require("axios");

    const apiKey = process.env.PIOPIY_API_KEY;
    const appId  = process.env.PIOPIY_APP_ID;

    if (!apiKey || !appId) {
        console.warn("[PIOPIY CDR Sync] PIOPIY_API_KEY or PIOPIY_APP_ID not set — skipping");
        return 0;
    }

    // Pull last 48h of CDRs
    const now      = Date.now();
    const start    = now - 48 * 60 * 60 * 1000;

    let cdrRecords = [];
    try {
        const resp = await axios.post("https://api.piopiy.com/sip/app/cdr/get", {
            app_id:     appId,
            start_time: start,
            end_time:   now,
            limit:      50,
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            timeout: 15000,
        });
        cdrRecords = resp.data?.cdr || [];
    } catch (err) {
        console.error("[PIOPIY CDR Sync] API error:", err.response?.data || err.message);
        return 0;
    }

    if (!cdrRecords.length) return 0;

    const fromPhone = String(process.env.ZENVOICE_FROM_PHONE || "").replace(/\D/g, "").slice(-10);
    const cutoff    = new Date(start);
    // Include INITIATED + any AI call logs still missing a recording URL
    const initiatedLogs = await prisma.callLog.findMany({
        where: {
            recordingUrl: null,
            agentNumber: { endsWith: fromPhone },
            createdAt: { gte: cutoff },
        },
    });
    if (!initiatedLogs.length) return 0;

    let updated = 0;
    for (const crmLog of initiatedLogs) {
        const crmPhone = String(crmLog.toNumber || "").replace(/\D/g, "").slice(-10);

        // Match CDR by to_number + time within 5 minutes
        const match = cdrRecords.find((c) => {
            const cdrPhone = String(c.to_number || c.caller_id || "").replace(/\D/g, "").slice(-10);
            if (cdrPhone !== crmPhone) return false;
            const diff = Math.abs(Number(c.timestamp) - new Date(crmLog.callDate || crmLog.createdAt).getTime());
            return diff < 5 * 60 * 1000;
        });

        if (!match) continue;

        const rawStatus = String(match.status || "").toLowerCase();
        const callStatus = rawStatus === "answered" ? "COMPLETED"
                         : rawStatus === "missed" || rawStatus === "unanswered" ? "NO_ANSWER"
                         : "FAILED";

        const hasNewRecording = !!match.file_name;
        await prisma.callLog.update({
            where: { id: crmLog.id },
            data: {
                callStatus,
                duration: match.answer_sec || match.duration || 0,
                greeterCallId: match.call_id || null,
                ...(hasNewRecording ? { recordingUrl: String(match.file_name) } : {}),
            },
        });
        updated++;
        console.log(`[PIOPIY CDR Sync] callLog ${crmLog.id} → ${callStatus}, recording: ${match.file_name || "none"}`);

        // Auto-transcribe when a recording just arrived for a completed call
        if (hasNewRecording && callStatus === "COMPLETED" && !crmLog.isTranscribed) {
            setImmediate(async () => {
                try {
                    const { transcribeFromUrl } = require("./transcriptionService");
                    const saveTranscription = require("../jobs/autoTranscribeJob").saveTranscription;
                    const piopiyKey = process.env.PIOPIY_API_KEY;
                    if (!piopiyKey) {
                        console.warn(`[Auto-Transcribe] PIOPIY_API_KEY not set — skipping for callLog ${crmLog.id}`);
                        return;
                    }
                    const downloadUrl = `https://api.piopiy.com/sip/app/call/recording/play/${encodeURIComponent(String(match.file_name))}`;
                    console.log(`[Auto-Transcribe] PIOPIY callLog ${crmLog.id}: ${downloadUrl}`);
                    const result = await transcribeFromUrl(downloadUrl, { Authorization: `Bearer ${piopiyKey}` });

                    // Fetch fresh callLog with lead relation so saveTranscription can apply scoring
                    const callLogWithLead = await prisma.callLog.findUnique({
                        where: { id: crmLog.id },
                        include: { lead: { select: { workspaceId: true, status: true } } },
                    });
                    await saveTranscription(callLogWithLead, result);
                    console.log(`[Auto-Transcribe] callLog ${crmLog.id} transcribed + scored successfully.`);
                } catch (err) {
                    console.error(`[Auto-Transcribe] Failed for callLog ${crmLog.id}:`, err.message);
                }
            });
        }
    }

    return updated;
};

module.exports = {
    fetchAssistants,
    makeCall,
    signIn,
    syncCallLogs,
    syncPiopiyCDR,
};
