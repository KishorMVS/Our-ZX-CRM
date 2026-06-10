const axios = require("axios");
const prisma = require("../utils/prisma");

const VL_BASE = "https://app.voicelink.co.in/api/v1";
const VL_AUTH = `${VL_BASE}/auth/login`;
const REFRESH_INTERVAL = 50 * 60 * 1000; // refresh well before the 60-min expiry
const CLIENT_TOKEN_TTL = 60 * 60 * 1000; // VoiceLink tokens last ~60 min

// ── Reseller token (PLATFORM_OWNER level, single global account) ──────────────
//
// IMPORTANT: the reseller token is kept IN MEMORY ONLY. It used to be persisted
// into CompanySettings.voiceLinkToken via findFirst(), which clobbered the
// per-workspace ZenVoice SSO token stored in that same column. The reseller
// account logs in fresh on boot (and on demand), so no persistence is needed.
let _resellerToken = null;
let _resellerRefreshing = null; // de-dupes concurrent refreshes

const refreshResellerToken = async () => {
    // If a refresh is already in flight, await it instead of logging in again.
    // (VoiceLink appears to be single-session: concurrent logins invalidate
    // each other, which previously caused the "retry in a moment" loop.)
    if (_resellerRefreshing) return _resellerRefreshing;

    _resellerRefreshing = (async () => {
        try {
            const res = await axios.post(
                VL_AUTH,
                { username: process.env.VOICELINK_USERNAME, password: process.env.VOICELINK_PASSWORD },
                { headers: { "Content-Type": "application/json" }, timeout: 15000 }
            );
            const token = res.data?.data?.access_token || res.data?.access_token || res.data?.token;
            if (!token) throw new Error("No token in VoiceLink reseller login response");
            _resellerToken = token;
            console.log(`[VoiceLink] Reseller token refreshed at ${new Date().toISOString()}`);
            return token;
        } catch (err) {
            console.error("[VoiceLink] Reseller token refresh failed:", err?.response?.data || err.message);
            throw err;
        } finally {
            _resellerRefreshing = null;
        }
    })();

    return _resellerRefreshing;
};

const getResellerToken = () => _resellerToken;

// Returns a usable reseller token, logging in on demand if we don't have one.
const getValidResellerToken = async () => _resellerToken || (await refreshResellerToken());

/**
 * Centralized reseller API call: attaches the token, and on a 401 refreshes the
 * token ONCE and retries the same request. This replaces the old fire-and-forget
 * "retry in a moment" behavior so callers get real data on the first request.
 * @returns response.data — throws on failure (err.statusCode set for the route).
 */
const resellerRequest = async (method, url, { data = null, params = null } = {}) => {
    const m = method.toLowerCase();
    const doCall = async (token) => {
        const cfg = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 30000 };
        if (params) cfg.params = params;
        const res = (m === "get" || m === "delete")
            ? await axios[m](url, cfg)
            : await axios[m](url, data, cfg);
        return res.data;
    };

    let token = await getValidResellerToken();
    try {
        return await doCall(token);
    } catch (err) {
        if (err?.response?.status === 401) {
            token = await refreshResellerToken();
            return await doCall(token); // single retry with a fresh token
        }
        const e = new Error(err?.response?.data?.message || err?.response?.data?.error || err.message);
        e.statusCode = err?.response?.status;
        e.responseData = err?.response?.data;
        throw e;
    }
};

// ── Client token (per-tenant / per-company VoiceLink account) ─────────────────
//
// Each company (workspace) gets its own VoiceLinkClient created via the reseller
// API. Its username/password are stored on the VoiceLinkClient row. We log in
// with those credentials to obtain that tenant's OWN token, cache it on the row,
// and transparently re-login whenever it is missing or expired — so a valid
// client session is always available without the operator re-entering anything.

const loginAsClient = async (username, password) => {
    const res = await axios.post(
        VL_AUTH,
        { username, password },
        { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    return res.data?.data?.access_token || res.data?.access_token || res.data?.token;
};

const persistClientToken = async (vlClient, token) => {
    const tokenExpiry = new Date(Date.now() + CLIENT_TOKEN_TTL);
    await prisma.voiceLinkClient.update({ where: { id: vlClient.id }, data: { token, tokenExpiry } });
    // keep the in-memory object in sync for the rest of this request
    vlClient.token = token;
    vlClient.tokenExpiry = tokenExpiry;
    return token;
};

/**
 * Returns a valid token for this client, logging in with the stored credentials
 * when the cached token is missing or within 60s of expiry.
 */
const getClientToken = async (vlClient) => {
    const stillFresh =
        vlClient.token &&
        vlClient.tokenExpiry &&
        new Date(vlClient.tokenExpiry).getTime() > Date.now() + 60 * 1000;
    if (stillFresh) return vlClient.token;

    const token = await loginAsClient(vlClient.username, vlClient.password);
    if (!token) throw new Error("VoiceLink client login returned no token");
    return persistClientToken(vlClient, token);
};

// Back-compat wrapper kept for any external callers.
const refreshClientToken = async (vlClient) => {
    try {
        const token = await loginAsClient(vlClient.username, vlClient.password);
        if (!token) return null;
        return persistClientToken(vlClient, token);
    } catch (err) {
        console.error(`[VoiceLink] Client ${vlClient.clientId} token refresh failed:`, err?.response?.data || err.message);
        return null;
    }
};

/**
 * Authenticated request on behalf of a specific client account, with a single
 * re-login + retry on 401.
 */
const clientRequest = async (vlClient, method, url, { data = null, params = null } = {}) => {
    const m = method.toLowerCase();
    const doCall = async (token) => {
        const cfg = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 30000 };
        if (params) cfg.params = params;
        const res = (m === "get" || m === "delete")
            ? await axios[m](url, cfg)
            : await axios[m](url, data, cfg);
        return res.data;
    };

    let token = await getClientToken(vlClient);
    try {
        return await doCall(token);
    } catch (err) {
        if (err?.response?.status === 401) {
            const fresh = await loginAsClient(vlClient.username, vlClient.password);
            if (fresh) {
                await persistClientToken(vlClient, fresh);
                return await doCall(fresh);
            }
        }
        const e = new Error(err?.response?.data?.message || err?.response?.data?.error || err.message);
        e.statusCode = err?.response?.status;
        e.responseData = err?.response?.data;
        throw e;
    }
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const startTokenRefresh = async () => {
    // Acquire a reseller token immediately so the first request isn't delayed,
    // then keep it warm on an interval. On-demand refresh (getValidResellerToken)
    // covers any gap if this initial login is slow or fails.
    try {
        await refreshResellerToken();
    } catch {
        /* getValidResellerToken will retry on the first request */
    }
    setInterval(() => {
        refreshResellerToken().catch(() => {});
    }, REFRESH_INTERVAL);
};

module.exports = {
    startTokenRefresh,
    getResellerToken,
    getValidResellerToken,
    refreshResellerToken,
    resellerRequest,
    loginAsClient,
    getClientToken,
    refreshClientToken,
    clientRequest,
};
