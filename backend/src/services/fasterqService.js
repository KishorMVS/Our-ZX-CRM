const axios = require("axios");

const FASTERQ_BASE = "https://api.fasterq.in";

const makeClient = (apiKey) =>
    axios.create({
        baseURL: FASTERQ_BASE,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 20000,
    });

// Kept for backward-compat usage in debugCalls
const client = makeClient(process.env.FASTERQ_API_KEY || "");

// ── In-memory cache (60s TTL) ─────────────────────────────────────────────────
const CACHE_TTL = 60 * 1000;
const _cache = new Map();

const _getCached = (key) => {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
    return entry.data;
};

const _setCached = (key, data) => _cache.set(key, { data, ts: Date.now() });

const toUtcStart = (dateStr) => `${dateStr}T00:00:00Z`;
const toUtcEnd   = (dateStr) => `${dateStr}T23:59:59Z`;

const splitDateRange = (from, to, maxDays = 7) => {
    const chunks = [];
    let cursor = new Date(from + "T00:00:00Z");
    const end  = new Date(to   + "T00:00:00Z");

    while (cursor <= end) {
        const chunkEnd = new Date(cursor);
        chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
        if (chunkEnd > end) chunkEnd.setTime(end.getTime());

        const fmtDate = (d) => d.toISOString().split("T")[0];
        chunks.push({ from: fmtDate(cursor), to: fmtDate(chunkEnd) });

        cursor = new Date(chunkEnd);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return chunks;
};

const LIMIT     = 500;
const MAX_DEPTH = 4;

// ── Core: fetch all calls for a date range using a specific API key ───────────
const fetchAllCalls = async (params = {}, apiKey) => {
    const { from, to } = params;
    if (!from || !to) return { data: [] };

    const key = apiKey || process.env.FASTERQ_API_KEY || "";
    if (!key) {
        const err = new Error("FasterQ API key not configured");
        err.status = 401;
        throw err;
    }

    const cacheKey = `all-calls:${key.slice(-8)}:${from}:${to}`;
    const cached   = _getCached(cacheKey);
    if (cached) {
        console.log(`[FASTERQ CACHE HIT] ${from}→${to}: ${cached.data.length} calls`);
        return cached;
    }

    const c = makeClient(key);
    const byCallId = new Map();

    const fetchChunk = async (fromDate, toDate, depth = 0) => {
        try {
            const response = await c.get("/api/integrations/calls", {
                params: { from: toUtcStart(fromDate), to: toUtcEnd(toDate), limit: LIMIT },
            });

            const body  = response.data || {};
            const calls = Array.isArray(body.data) ? body.data : [];
            const meta  = body.meta || {};

            let newCount = 0, dupCount = 0;
            for (const call of calls) {
                if (!call.callId) continue;
                if (byCallId.has(call.callId)) { dupCount++; continue; }
                byCallId.set(call.callId, call);
                newCount++;
            }

            console.log(`[FASTERQ] ${fromDate}→${toDate} depth=${depth}: fetched=${calls.length} new=${newCount} dup=${dupCount} | unique=${byCallId.size} | meta=${JSON.stringify(meta)}`);

            if (calls.length >= LIMIT && depth < MAX_DEPTH && fromDate !== toDate) {
                const start = new Date(fromDate + "T00:00:00Z");
                const end   = new Date(toDate   + "T00:00:00Z");
                const mid   = new Date((start.getTime() + end.getTime()) / 2);
                const fmt   = (d) => d.toISOString().split("T")[0];
                const midPlusOne = new Date(mid);
                midPlusOne.setUTCDate(midPlusOne.getUTCDate() + 1);
                await fetchChunk(fromDate,        fmt(mid),   depth + 1);
                await fetchChunk(fmt(midPlusOne), toDate,     depth + 1);
            }
        } catch (err) {
            console.error(`[FASTERQ] ${fromDate}→${toDate} depth=${depth} error:`, err.message);
            if (depth === 0) throw err;
        }
    };

    for (const chunk of splitDateRange(from, to, 7)) {
        await fetchChunk(chunk.from, chunk.to);
    }

    const allCalls = Array.from(byCallId.values());
    console.log(`[FASTERQ] DONE: ${allCalls.length} unique calls for ${from}→${to}`);
    const result = { data: allCalls };
    _setCached(cacheKey, result);
    return result;
};

// Legacy single-chunk fetch (unused in main flow but kept for debugCalls)
const fetchCalls = async (params = {}) => {
    const { from, to, page = 1, limit = 20 } = params;
    const cacheKey = `calls:${from}:${to}:${page}:${limit}`;
    const cached   = _getCached(cacheKey);
    if (cached) return cached;

    try {
        const response = await client.get("/api/integrations/calls", {
            params: { from: toUtcStart(from), to: toUtcEnd(to), page, limit },
        });
        _setCached(cacheKey, response.data);
        return response.data;
    } catch (err) {
        const status  = err.response?.status;
        const message = err.response?.data?.message || err.message || "FasterQ API error";
        const error   = new Error(message);
        error.status  = status;
        throw error;
    }
};

module.exports = { fetchCalls, fetchAllCalls, splitDateRange, client, makeClient };
