const axios = require("axios");
const prisma = require("../utils/prisma");
const fasterqService = require("../services/fasterqService");

const handleError = (err, res) => {
    if (err.status === 401 || err.message?.includes("not configured")) {
        return res.status(422).json({ message: "FasterQ not connected", code: "NOT_CONFIGURED" });
    }
    const status = err.status === 403 ? 502 : (err.status || 500);
    res.status(status).json({ message: err.message || "FasterQ API error", upstream: err.status });
};

const normalizePhone = (p) => (p || "").replace(/\D/g, "").slice(-10);

// ── Helper: get workspace FasterQ key (falls back to env) ────────────────────
const getApiKey = async (workspaceId) => {
    if (workspaceId) {
        const settings = await prisma.companySettings.findFirst({ where: { workspaceId } });
        if (settings?.fasterqApiKey) return settings.fasterqApiKey;
    }
    return process.env.FASTERQ_API_KEY || "";
};

// ── GET /api/fasterq/settings ────────────────────────────────────────────────
const getSettings = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const settings = workspaceId
            ? await prisma.companySettings.findFirst({ where: { workspaceId } })
            : null;

        const key = settings?.fasterqApiKey || "";
        res.json({
            connected: key.length > 0,
            maskedKey: key ? `${key.slice(0, 12)}${"•".repeat(Math.max(0, key.length - 16))}${key.slice(-4)}` : "",
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching FasterQ settings", error: err.message });
    }
};

// ── POST /api/fasterq/settings ───────────────────────────────────────────────
const saveSettings = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { apiKey } = req.body;

        if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
            return res.status(400).json({ message: "API key is required" });
        }

        const trimmed = apiKey.trim();

        // Validate key against FasterQ before saving
        try {
            const testClient = fasterqService.makeClient(trimmed);
            const now = new Date().toISOString().split("T")[0];
            await testClient.get("/api/integrations/calls", {
                params: { from: `${now}T00:00:00Z`, to: `${now}T23:59:59Z`, limit: 1 },
            });
        } catch (testErr) {
            const status = testErr.response?.status;
            if (status === 401 || status === 403) {
                return res.status(400).json({ message: "Invalid API key — FasterQ rejected it" });
            }
            // Non-auth errors (network, 5xx) — allow saving anyway
        }

        if (workspaceId) {
            await prisma.companySettings.updateMany({
                where: { workspaceId },
                data: { fasterqApiKey: trimmed },
            });
        }

        res.json({ message: "FasterQ API key saved", connected: true });
    } catch (err) {
        res.status(500).json({ message: "Error saving FasterQ settings", error: err.message });
    }
};

// ── DELETE /api/fasterq/settings ─────────────────────────────────────────────
const deleteSettings = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (workspaceId) {
            await prisma.companySettings.updateMany({
                where: { workspaceId },
                data: { fasterqApiKey: "" },
            });
        }
        res.json({ message: "FasterQ integration disconnected" });
    } catch (err) {
        res.status(500).json({ message: "Error removing FasterQ settings", error: err.message });
    }
};

// ── GET /api/fasterq/calls ───────────────────────────────────────────────────
const getCalls = async (req, res) => {
    try {
        const { from, to, page, limit, userId, userPhone } = req.query;
        const { workspaceId } = req.user;
        const apiKey = await getApiKey(workspaceId);

        const pageNum  = parseInt(page)  || 1;
        const limitNum = parseInt(limit) || 50;

        const data     = await fasterqService.fetchAllCalls({ from, to }, apiKey);
        const allCalls = Array.isArray(data?.data) ? data.data : [];

        const targetPhone = normalizePhone(userPhone);
        const startTime   = new Date(from + "T00:00:00Z").getTime();
        const endTime     = new Date(to   + "T23:59:59Z").getTime();

        const filtered = allCalls.filter(c => {
            const callTime = new Date(c.startTime || c.createdAt || 0).getTime();
            if (callTime < startTime || callTime > endTime) return false;
            if (userId    && c.userId    && c.userId !== userId) return false;
            if (targetPhone && normalizePhone(c.userPhone) !== targetPhone) return false;
            return true;
        });

        filtered.sort((a, b) => {
            const ta = new Date(a.startTime || a.createdAt || 0).getTime();
            const tb = new Date(b.startTime || b.createdAt || 0).getTime();
            return tb - ta;
        });

        const total      = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        const start      = (pageNum - 1) * limitNum;

        res.json({
            data: filtered.slice(start, start + limitNum),
            meta: { total, page: pageNum, perPage: limitNum, totalPages },
        });
    } catch (err) {
        handleError(err, res);
    }
};

// ── GET /api/fasterq/agent-calls ─────────────────────────────────────────────
const getAgentCalls = async (req, res) => {
    try {
        const { from, to, userId, userPhone, page, limit } = req.query;
        const { workspaceId } = req.user;
        const apiKey = await getApiKey(workspaceId);

        const pageNum  = parseInt(page)  || 1;
        const limitNum = parseInt(limit) || 50;

        const data     = await fasterqService.fetchAllCalls({ from, to }, apiKey);
        const allCalls = Array.isArray(data?.data) ? data.data : [];

        const targetPhone = normalizePhone(userPhone);
        const startTime   = new Date(from + "T00:00:00Z").getTime();
        const endTime     = new Date(to   + "T23:59:59Z").getTime();

        const filtered = allCalls.filter(c => {
            const callTime = new Date(c.startTime || c.createdAt || 0).getTime();
            if (callTime < startTime || callTime > endTime) return false;
            if (userId    && c.userId    && c.userId === userId)            return true;
            if (targetPhone && normalizePhone(c.userPhone) === targetPhone) return true;
            return false;
        });

        filtered.sort((a, b) => {
            const ta = new Date(a.startTime || a.createdAt || 0).getTime();
            const tb = new Date(b.startTime || b.createdAt || 0).getTime();
            return tb - ta;
        });

        const total      = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        const start      = (pageNum - 1) * limitNum;

        res.json({
            data: filtered.slice(start, start + limitNum),
            meta: { total, page: pageNum, perPage: limitNum, totalPages },
        });
    } catch (err) {
        handleError(err, res);
    }
};

// ── GET /api/fasterq/analytics ───────────────────────────────────────────────
const getAnalytics = async (req, res) => {
    try {
        const { from, to } = req.query;
        const { workspaceId } = req.user;
        const apiKey = await getApiKey(workspaceId);

        const data     = await fasterqService.fetchAllCalls({ from, to }, apiKey);
        const allCalls = Array.isArray(data?.data) ? data.data : [];

        const startTime = new Date(from + "T00:00:00Z").getTime();
        const endTime   = new Date(to   + "T23:59:59Z").getTime();
        const calls     = allCalls.filter(c => {
            const callTime = new Date(c.startTime || c.createdAt || 0).getTime();
            return callTime >= startTime && callTime <= endTime;
        });

        const total         = calls.length;
        const answered      = calls.filter(c =>  c.answered).length;
        const inbound       = calls.filter(c =>  c.inbound).length;
        const outbound      = calls.filter(c => !c.inbound).length;
        const missedInbound = calls.filter(c =>  c.inbound && !c.answered).length;
        const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
        const avgDuration   = answered > 0 ? Math.round(totalDuration / answered) : 0;

        const daywiseMap = {};
        calls.forEach(c => {
            const date = (c.startTime || c.createdAt || "").split("T")[0];
            if (!date) return;
            if (!daywiseMap[date]) daywiseMap[date] = { date, total: 0, answered: 0, missed: 0 };
            daywiseMap[date].total++;
            c.answered ? daywiseMap[date].answered++ : daywiseMap[date].missed++;
        });
        const daywise = Object.values(daywiseMap).sort((a, b) => a.date.localeCompare(b.date));

        const hourlyMap = {};
        calls.forEach(c => {
            const dt = c.startTime || c.createdAt;
            if (!dt) return;
            const hour  = new Date(dt).getHours();
            const label = `${String(hour).padStart(2, "0")}:00`;
            if (!hourlyMap[label]) hourlyMap[label] = { hour: label, total: 0, answered: 0, missed: 0 };
            hourlyMap[label].total++;
            c.answered ? hourlyMap[label].answered++ : hourlyMap[label].missed++;
        });
        const hourly = Object.values(hourlyMap).sort((a, b) => a.hour.localeCompare(b.hour));

        const agentMap = {};
        calls.forEach(c => {
            const id = c.userId || c.userPhone || "unknown";
            if (!agentMap[id]) {
                agentMap[id] = {
                    userId: id,
                    userName: c.userName || "Unknown",
                    userPhone: c.userPhone || "",
                    total: 0, answered: 0, inbound: 0, outbound: 0, totalDuration: 0,
                };
            }
            agentMap[id].total++;
            if (c.answered) agentMap[id].answered++;
            if (c.inbound)  agentMap[id].inbound++;
            else            agentMap[id].outbound++;
            agentMap[id].totalDuration += (c.duration || 0);
        });
        const agents = Object.values(agentMap).sort((a, b) => b.total - a.total);

        const topByTotal    = agents.reduce((b, a) => !b || a.total         > b.total         ? a : b, null);
        const topByDuration = agents.reduce((b, a) => !b || a.totalDuration > b.totalDuration ? a : b, null);
        const topByOutbound = agents.reduce((b, a) => !b || a.outbound      > b.outbound      ? a : b, null);
        const topByAnswered = agents.reduce((b, a) => !b || a.answered      > b.answered      ? a : b, null);
        const longestCall   = calls.reduce((b, c) => !b || (c.duration || 0) > (b.duration || 0) ? c : b, null);

        res.json({
            summary: { total, answered, inbound, outbound, missedInbound, totalDuration, avgDuration },
            daywise,
            hourly,
            agents,
            topPerformers: { topByTotal, topByDuration, topByOutbound, topByAnswered },
            longestCall,
        });
    } catch (err) {
        handleError(err, res);
    }
};

// ── GET /api/fasterq/recording ───────────────────────────────────────────────
const streamRecording = async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: "url query param required" });

    try {
        const decoded = decodeURIComponent(url);
        const headers = {};
        if (req.headers.range) headers.Range = req.headers.range;

        const response = await axios.get(decoded, { responseType: "stream", timeout: 30000, headers });

        const contentType   = response.headers["content-type"]   || "audio/mpeg";
        const contentLength = response.headers["content-length"];
        const contentRange  = response.headers["content-range"];

        res.status(response.status);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Accept-Ranges", "bytes");
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (contentRange)  res.setHeader("Content-Range", contentRange);
        res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");

        response.data.pipe(res);
    } catch (err) {
        console.error("[FASTERQ RECORDING]", err.message);
        res.status(502).json({ message: "Could not fetch recording", error: err.message });
    }
};

// ── GET /api/fasterq/debug ───────────────────────────────────────────────────
const debugCalls = async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: "from and to are required" });

    const { client } = fasterqService;
    const fromUtc = `${from}T00:00:00Z`;
    const toUtc   = `${to}T23:59:59Z`;

    const probe = async (label, params) => {
        try {
            const r    = await client.get("/api/integrations/calls", { params });
            const data = Array.isArray(r.data?.data) ? r.data.data : [];
            const ids  = data.map(c => c.callId || c.id || c._id || `${c.startTime}|${c.userPhone}|${c.clientPhone || c.contactNumber}`);
            return { label, params, status: r.status, meta: r.data?.meta || null, count: data.length, ids, sample: data[0] || null };
        } catch (err) {
            return { label, params, error: err.response?.status || err.message, body: err.response?.data };
        }
    };

    const results = await Promise.all([
        probe("page=1 limit=20",  { from: fromUtc, to: toUtc, page: 1, limit: 20 }),
        probe("page=2 limit=20",  { from: fromUtc, to: toUtc, page: 2, limit: 20 }),
        probe("page=1 limit=500", { from: fromUtc, to: toUtc, page: 1, limit: 500 }),
    ]);

    res.json({ range: { from, to }, results });
};

// ── Transcribe a call recording & (optionally) score the linked lead ─────────
const transcribeRecording = async (req, res) => {
    const { recordingUrl, leadId } = req.body;
    if (!recordingUrl) {
        return res.status(400).json({ message: "recordingUrl is required in the request body" });
    }

    try {
        console.log(`[FASTERQ TRANSCRIBE] Starting transcription for: ${recordingUrl}`);

        const { transcribeFromUrl, scoreCallConversation } = require("../services/transcriptionService");
        const calculateLeadScore = require("../utils/leadScorer");

        const result = await transcribeFromUrl(recordingUrl);
        console.log(`[FASTERQ TRANSCRIBE] Transcription complete.`);

        // Fetch workspace scoring config
        const workspaceId = req.user?.workspaceId;
        let callScore = 0;
        let scoreBreakdown = [];

        const settings = workspaceId
            ? await prisma.companySettings.findFirst({ where: { workspaceId } })
            : null;

        const scoringParams = settings?.callScoringConfig || [];

        if (scoringParams.length > 0 && result.plainText) {
            const scored = await scoreCallConversation(result.plainText, scoringParams);
            callScore = scored.callScore;
            scoreBreakdown = scored.scoreBreakdown;
        }

        // Update lead score if leadId was provided
        let updatedLeadScore = null;
        if (leadId && callScore > 0) {
            const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, score: true, scoreUpdated: true } });
            if (lead) {
                const newScore = Math.min((lead.score || 0) + callScore, 99); // cap at 99; only explicit conversion sets 100
                const { category } = calculateLeadScore({ score: newScore, scoreUpdated: true });
                await prisma.lead.update({
                    where: { id: leadId },
                    data: { score: newScore, scoreUpdated: true, category },
                });
                updatedLeadScore = newScore;
                console.log(`[FASTERQ TRANSCRIBE] Lead ${leadId} score updated: ${lead.score} → ${newScore}`);
            }
        }

        res.json({
            message: "Transcription complete",
            transcription: result.transcription,
            plainText: result.plainText,
            summary: result.summary,
            tone: result.tone,
            urgency: result.urgency,
            emotion: result.emotion,
            category: result.category,
            sentiment: result.sentiment,
            feedback: result.feedback,
            conclusion: result.conclusion,
            duration: result.duration,
            callScore,
            scoreBreakdown,
            updatedLeadScore,
        });
    } catch (err) {
        console.error("[FASTERQ TRANSCRIBE] Error:", err.message);
        res.status(500).json({ message: "Transcription failed", error: err.message });
    }
};

module.exports = { getCalls, getAgentCalls, getAnalytics, streamRecording, debugCalls, getSettings, saveSettings, deleteSettings, transcribeRecording };
