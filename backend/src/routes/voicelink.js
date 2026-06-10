const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const prisma = require("../utils/prisma");
const {
    getValidResellerToken,
    resellerRequest,
    getClientToken,
} = require("../services/voicelinkService");

const VL_RESELLER = "https://app.voicelink.co.in/api/v1/reseller";
const HARDCODED_EMAIL = "kishor@hexitetechnologies.com";
const NEGATIVE_THRESHOLD_DEFAULT = 0;

// PLATFORM_OWNER = reseller-level operations (manages the single reseller account)
// SUPER_ADMIN    = client-level operations (their company's own ZenCall client)
const resellerLevel = [authMiddleware, roleMiddleware(["PLATFORM_OWNER"])];
const clientLevel   = [authMiddleware, roleMiddleware(["SUPER_ADMIN"])];
const anyZenCall    = [authMiddleware, roleMiddleware(["PLATFORM_OWNER", "SUPER_ADMIN"])];

// Map VoiceLink 401 → 502 so the frontend auth-logout interceptor is NOT triggered.
const vlSafeStatus = (status) => (status === 401 ? 502 : (status || 500));

// resellerRequest/clientRequest throw errors carrying { statusCode, message }.
const vlErr = (res, err) => {
    const status = err?.statusCode;
    const message = status === 401
        ? "VoiceLink authentication failed. Please try again in a moment."
        : (err?.message || "VoiceLink request failed");
    return res.status(vlSafeStatus(status)).json({ message });
};

// ── Token status ──────────────────────────────────────────────────────────────

// Truthful readiness: actually attempts to acquire a reseller token.
router.get("/token-status", ...anyZenCall, async (_req, res) => {
    try {
        const token = await getValidResellerToken();
        res.json({ ready: !!token });
    } catch {
        res.json({ ready: false });
    }
});

// ── CompanySettings voiceLinkToken (per-workspace ZenVoice SSO token) ──────────
// NOTE: this column holds the per-workspace ZenVoice token. The global reseller
// token is no longer written here (it lives in-memory in voicelinkService).

router.get("/token", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const settings = await prisma.companySettings.findFirst({ where: { workspaceId } });
        const raw = settings?.voiceLinkToken || "";
        res.json({
            configured: raw.length > 0,
            masked: raw.length > 4 ? "••••" + raw.slice(-4) : (raw.length > 0 ? "••••" : null),
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching VoiceLink token", error: err.message });
    }
});

router.patch("/token", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { voiceLinkToken } = req.body;
        if (!voiceLinkToken) return res.status(400).json({ message: "voiceLinkToken is required" });
        await prisma.companySettings.upsert({
            where: { workspaceId },
            create: { workspaceId, voiceLinkToken },
            update: { voiceLinkToken },
        });
        res.json({ message: "VoiceLink token saved" });
    } catch (err) {
        res.status(500).json({ message: "Error saving VoiceLink token", error: err.message });
    }
});

// ── SUPER_ADMIN: own (per-tenant) client account ──────────────────────────────

// GET /api/voicelink/my-account — returns the VoiceLinkClient linked to this user
router.get("/my-account", ...clientLevel, async (req, res) => {
    try {
        const client = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!client) return res.json({ client: null });
        const { password, token, tokenExpiry, ...safe } = client;
        res.json({ client: safe, hasToken: !!token });
    } catch (err) {
        console.error("[VoiceLink] my-account failed:", err);
        res.status(500).json({ message: "Failed to fetch ZenCall account info" });
    }
});

// GET /api/voicelink/client — alias of my-account for backward compat
router.get("/client", ...clientLevel, async (req, res) => {
    try {
        const client = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!client) return res.json({ client: null });
        const { password, token, tokenExpiry, ...safe } = client;
        res.json({ client: safe, hasToken: !!token });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch ZenCall client info" });
    }
});

// GET /api/voicelink/my-client/token-status — ensures this tenant's client token
// is valid (logs in with stored credentials if missing/expired) and reports it.
// This is what keeps a client session "running for them every time".
router.get("/my-client/token-status", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ ready: false, message: "No ZenCall account found." });
        try {
            await getClientToken(dbClient);
            res.json({ ready: true, username: dbClient.username, expiresAt: dbClient.tokenExpiry });
        } catch (e) {
            console.warn("[VoiceLink] my-client token login failed:", e.message);
            res.json({ ready: false, username: dbClient.username, message: "Client login failed." });
        }
    } catch (err) {
        res.status(500).json({ ready: false, message: "Failed to check client token." });
    }
});

// GET /api/voicelink/signup-config — reseller plan type to drive the purchase form
router.get("/signup-config", ...anyZenCall, async (_req, res) => {
    try {
        const profileData = await resellerRequest("get", `${VL_RESELLER}/profile`);
        const profile = profileData?.data || profileData;
        res.json({ resellerPlanType: profile?.plan_type || profile?.planType || "limited" });
    } catch {
        // Fallback to "limited" — safer default so extra fields are always shown.
        res.json({ resellerPlanType: "limited" });
    }
});

// POST /api/voicelink/self-signup — SUPER_ADMIN purchases ZenCall for their company
router.post("/self-signup", ...clientLevel, async (req, res) => {
    try {
        const existing = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (existing) return res.status(400).json({ message: "You already have a ZenCall account." });

        const {
            first_name, last_name, username, password, channel_count,
            plan_type, pulse_seconds, inbound_rate, outbound_rate,
        } = req.body;
        if (!first_name || !last_name || !username || !password || !channel_count) {
            return res.status(400).json({ message: "first_name, last_name, username, password, and channel_count are required." });
        }

        const userRecord = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { email: true, workspaceId: true },
        });

        const effectivePlanType = plan_type || "limited";
        const payload = {
            first_name, last_name, username,
            email: userRecord?.email || HARDCODED_EMAIL,
            password,
            channel_count: Number(channel_count),
            negative_threshold: NEGATIVE_THRESHOLD_DEFAULT,
            plan_type: effectivePlanType,
            is_active: 1,
        };
        if (effectivePlanType === "limited") {
            if (pulse_seconds != null) payload.pulse_seconds = Number(pulse_seconds);
            if (inbound_rate  != null) payload.inbound_rate  = Number(inbound_rate);
            if (outbound_rate != null) payload.outbound_rate = Number(outbound_rate);
        }

        // 1) Create the client account via the reseller API.
        const clientData = await resellerRequest("post", `${VL_RESELLER}/client/create`, { data: payload });
        const created = clientData?.data || clientData;
        const clientId = created?.client_id;
        if (!clientId) return res.status(500).json({ message: "Client created but no client_id returned." });

        // 2) Save the client's credentials, linked to this tenant's workspace.
        const dbClient = await prisma.voiceLinkClient.upsert({
            where: { clientId: Number(clientId) },
            update: {
                username, password, channelCount: Number(channel_count),
                token: null, tokenExpiry: null,
                userId: req.user.userId, workspaceId: userRecord?.workspaceId || null,
            },
            create: {
                clientId: Number(clientId), username, password,
                channelCount: Number(channel_count),
                userId: req.user.userId, workspaceId: userRecord?.workspaceId || null,
            },
        });

        // 3) Log in as the new client to populate their own token (retry — the
        //    account may need a moment to become active). Non-fatal on failure.
        let tokenReady = false;
        for (let attempt = 1; attempt <= 3 && !tokenReady; attempt++) {
            try {
                if (attempt > 1) await new Promise((r) => setTimeout(r, 2000 * (attempt - 1)));
                await getClientToken(dbClient);
                tokenReady = true;
            } catch (e) {
                console.warn(`[VoiceLink] Self-signup client login ${attempt}/3:`, e.message);
            }
        }

        res.status(201).json({ message: "ZenCall account created successfully.", clientId, tokenReady });
    } catch (error) {
        vlErr(res, error);
    }
});

// GET /api/voicelink/my-profile — SUPER_ADMIN: fetch this client's profile via reseller
router.get("/my-profile", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found." });

        const listRes = await resellerRequest("get", `${VL_RESELLER}/clients`);
        const raw = listRes?.data || listRes?.clients || listRes;
        const list = Array.isArray(raw) ? raw : [];

        const clientData = list.find((c) => {
            const id = c.client_id ?? c.clientId ?? c.id ?? c.client_ID;
            return Number(id) === dbClient.clientId;
        });

        if (!clientData) {
            const { password, token, tokenExpiry, ...safe } = dbClient;
            return res.json({ data: safe });
        }
        res.json({ data: clientData });
    } catch (err) {
        vlErr(res, err);
    }
});

// PATCH /api/voicelink/client/credentials — SUPER_ADMIN updates stored credentials
router.patch("/client/credentials", ...clientLevel, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ message: "Username and password are required." });

        const client = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!client) return res.status(404).json({ message: "No ZenCall account found." });

        // Clear the cached token so the next request logs in with the new creds.
        await prisma.voiceLinkClient.update({
            where: { id: client.id },
            data: { username, password, token: null, tokenExpiry: null },
        });

        res.json({ message: "Credentials saved successfully." });
    } catch (err) {
        res.status(500).json({ message: "Failed to save credentials.", error: err.message });
    }
});

// ── PLATFORM_OWNER: client management ─────────────────────────────────────────

// GET /api/voicelink/reseller/super-admins — list SUPER_ADMINs with assignment status
router.get("/reseller/super-admins", ...resellerLevel, async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: "SUPER_ADMIN", isActive: true },
            select: { id: true, name: true, email: true },
        });
        const clients = await prisma.voiceLinkClient.findMany({
            select: { userId: true, clientId: true, username: true },
        });
        const byUserId = {};
        for (const c of clients) { if (c.userId) byUserId[c.userId] = c; }

        res.json(users.map((u) => ({
            ...u,
            hasClient: !!byUserId[u.id],
            clientInfo: byUserId[u.id] || null,
        })));
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch super admins" });
    }
});

// POST /api/voicelink/client/create — PLATFORM_OWNER creates a client + links a SUPER_ADMIN
router.post("/client/create", ...resellerLevel, async (req, res) => {
    try {
        const { first_name, last_name, username, password, channel_count, plan_type, targetUserId } = req.body;
        if (!first_name || !last_name || !username || !password || !channel_count) {
            return res.status(400).json({ message: "first_name, last_name, username, password, and channel_count are required." });
        }

        const payload = {
            first_name, last_name, username,
            email: HARDCODED_EMAIL,
            password,
            channel_count: Number(channel_count),
            negative_threshold: NEGATIVE_THRESHOLD_DEFAULT,
            plan_type,
            is_active: 1,
        };

        const clientData = await resellerRequest("post", `${VL_RESELLER}/client/create`, { data: payload });
        const created = clientData?.data || clientData;
        const clientId = created?.client_id;
        if (!clientId) return res.status(500).json({ message: "Client created but no client_id returned." });

        // Resolve the target user's workspaceId so the client is linked to their company.
        let targetWorkspaceId = null;
        if (targetUserId) {
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId },
                select: { workspaceId: true },
            });
            targetWorkspaceId = targetUser?.workspaceId || null;
        }

        const dbClient = await prisma.voiceLinkClient.upsert({
            where: { clientId: Number(clientId) },
            update: {
                username, password, channelCount: Number(channel_count),
                token: null, tokenExpiry: null,
                userId: targetUserId || null, workspaceId: targetWorkspaceId,
            },
            create: {
                clientId: Number(clientId), username, password,
                channelCount: Number(channel_count),
                userId: targetUserId || null, workspaceId: targetWorkspaceId,
            },
        });

        // Best-effort login to populate the client's own token.
        try { await getClientToken(dbClient); } catch (e) {
            console.warn("[VoiceLink] Client login after create failed:", e.message);
        }

        res.status(201).json(created);
    } catch (error) {
        vlErr(res, error);
    }
});

// GET /api/voicelink/reseller/clients — list all clients from VoiceLink (enriched)
router.get("/reseller/clients", ...resellerLevel, async (_req, res) => {
    try {
        const raw = await resellerRequest("get", `${VL_RESELLER}/clients`);
        const list = raw?.data || raw?.clients || raw;

        const localClients = await prisma.voiceLinkClient.findMany({ select: { clientId: true, userId: true } });
        const localMap = {};
        for (const c of localClients) { localMap[c.clientId] = c; }

        const linkedUserIds = localClients.map((c) => c.userId).filter(Boolean);
        const users = linkedUserIds.length
            ? await prisma.user.findMany({ where: { id: { in: linkedUserIds } }, select: { id: true, name: true, email: true } })
            : [];
        const userMap = {};
        for (const u of users) { userMap[u.id] = u; }

        const enriched = (Array.isArray(list) ? list : []).map((c) => {
            const _id = c.client_id ?? c.clientId ?? c.id ?? c.client_ID;
            const local = localMap[_id];
            return {
                ...c,
                _id,
                assignedUserId: local?.userId || null,
                assignedUser: (local?.userId && userMap[local.userId]) || null,
            };
        });

        res.json(enriched);
    } catch (err) {
        vlErr(res, err);
    }
});

// GET /api/voicelink/reseller/profile
router.get("/reseller/profile", ...resellerLevel, async (_req, res) => {
    try {
        const data = await resellerRequest("get", `${VL_RESELLER}/profile`);
        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// PUT /api/voicelink/reseller/client/:clientId — update a client
router.put("/reseller/client/:clientId", ...resellerLevel, async (req, res) => {
    try {
        const { clientId } = req.params;
        const data = await resellerRequest("put", `${VL_RESELLER}/client/update/${clientId}`, { data: req.body });

        const updateData = {};
        if (req.body.username)      updateData.username     = req.body.username;
        if (req.body.password)    { updateData.password     = req.body.password; updateData.token = null; updateData.tokenExpiry = null; }
        if (req.body.channel_count) updateData.channelCount = Number(req.body.channel_count);
        if (req.body.targetUserId !== undefined) updateData.userId = req.body.targetUserId || null;
        if (Object.keys(updateData).length) {
            await prisma.voiceLinkClient.updateMany({ where: { clientId: Number(clientId) }, data: updateData });
        }

        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// DELETE /api/voicelink/reseller/client/:clientId — deactivate on VoiceLink + remove locally
router.delete("/reseller/client/:clientId", ...resellerLevel, async (req, res) => {
    try {
        const { clientId } = req.params;
        const local = await prisma.voiceLinkClient.findFirst({ where: { clientId: Number(clientId) } });
        if (local) {
            try {
                await resellerRequest("put", `${VL_RESELLER}/client/update/${clientId}`, {
                    data: { first_name: "", last_name: "", username: local.username || "", email: HARDCODED_EMAIL, is_active: 0 },
                });
            } catch (deactivateErr) {
                console.warn("[VoiceLink] Deactivate before remove failed:", deactivateErr?.message);
            }
            await prisma.voiceLinkClient.delete({ where: { id: local.id } });
        }
        res.json({ message: "Client removed from ZenCall." });
    } catch (err) {
        res.status(500).json({ message: "Failed to remove client.", error: err.message });
    }
});

// ── DID management (SUPER_ADMIN) ──────────────────────────────────────────────

// GET /api/voicelink/available-dids
router.get("/available-dids", ...clientLevel, async (_req, res) => {
    try {
        const data = await resellerRequest("get", `${VL_RESELLER}/client/available-dids`);
        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// GET /api/voicelink/my-assigned-dids — DIDs already assigned to this client.
router.get("/my-assigned-dids", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found." });
        const cid = dbClient.clientId;

        // Strategy 1: available-dids may include assigned DIDs with a client_id field.
        try {
            const r = await resellerRequest("get", `${VL_RESELLER}/client/available-dids`);
            const raw = r?.data || r || [];
            const allDids = Array.isArray(raw) ? raw : [];
            const mine = allDids.filter((d) => {
                const dCid = d.client_id ?? d.clientId ?? d.client_ID;
                return dCid != null && Number(dCid) === cid;
            });
            if (mine.length > 0) return res.json({ data: mine });
        } catch (e) {
            console.warn("[VoiceLink] my-assigned-dids: available-dids failed:", e?.message);
        }

        // Strategy 2: the client object in the clients list may embed its DIDs.
        try {
            const r = await resellerRequest("get", `${VL_RESELLER}/clients`);
            const raw = r?.data || r?.clients || r || [];
            const list = Array.isArray(raw) ? raw : [];
            const match = list.find((c) => Number(c.client_id ?? c.clientId ?? c.id ?? c.client_ID) === cid);
            if (match) {
                const dids = match.dids ?? match.did_numbers ?? match.mapped_dids ?? match.did_list ?? [];
                if (Array.isArray(dids) && dids.length > 0) return res.json({ data: dids });
            }
        } catch (e) {
            console.warn("[VoiceLink] my-assigned-dids: clients list failed:", e?.message);
        }

        res.json({ data: [] });
    } catch (err) {
        vlErr(res, err);
    }
});

// POST /api/voicelink/map-did
router.post("/map-did", ...clientLevel, async (req, res) => {
    try {
        const data = await resellerRequest("post", `${VL_RESELLER}/client/map-did`, { data: req.body });
        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// ── KYC (SUPER_ADMIN) ─────────────────────────────────────────────────────────

const kycProxy = async (method, endpoint, req, res) => {
    try {
        const url = `${VL_RESELLER}/${endpoint}`;
        const data = method === "get"
            ? await resellerRequest("get", url, { params: req.query })
            : await resellerRequest("post", url, { data: req.body });
        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
};

router.get("/kyc/status",  ...clientLevel, (req, res) => kycProxy("get",  "kyc/status",                  req, res));
router.post("/kyc/step-1", ...clientLevel, (req, res) => kycProxy("post", "kyc/step-1-register-details", req, res));
router.post("/kyc/step-2", ...clientLevel, (req, res) => kycProxy("post", "kyc/step-2-pan-verify",       req, res));
router.post("/kyc/step-4", ...clientLevel, (req, res) => kycProxy("post", "kyc/step-4-gst-verify",       req, res));

// POST /api/voicelink/kyc/step-3-init — inject redirect_url so DigiLocker returns to /zencall
router.post("/kyc/step-3-init", ...clientLevel, async (req, res) => {
    try {
        const body = {
            ...req.body,
            redirect_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/zencall`,
        };
        const data = await resellerRequest("post", `${VL_RESELLER}/kyc/step-3-aadhaar-init`, { data: body });
        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// POST /api/voicelink/kyc/final-submit — notifies PLATFORM_OWNER after submission
router.post("/kyc/final-submit", ...clientLevel, async (req, res) => {
    try {
        const data = await resellerRequest("post", `${VL_RESELLER}/kyc/final-submit`, { data: req.body });

        const { createNotification } = require("../services/notificationService");
        const platformOwners = await prisma.user.findMany({
            where: { role: "PLATFORM_OWNER", isActive: true },
            select: { id: true },
        });
        for (const po of platformOwners) {
            await createNotification({
                userId:  po.id,
                title:   "ZenCall KYC Submitted",
                message: "A client has submitted KYC verification. Check the ZenCall Reseller panel.",
                type:    "KYC_SUBMITTED",
                link:    "/zencall",
            }).catch(() => {});
        }

        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// POST /api/voicelink/kyc/notify-completed
router.post("/kyc/notify-completed", ...clientLevel, async (req, res) => {
    try {
        const { createNotification } = require("../services/notificationService");
        await createNotification({
            userId:  req.user.userId,
            title:   "KYC Approved!",
            message: "Your ZenCall KYC verification has been approved. You can now select and assign phone numbers.",
            type:    "KYC_APPROVED",
            link:    "/zencall",
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: "Failed to create notification" });
    }
});

// ── Cloud Dialer: SIP Trunks ──────────────────────────────────────────────────

// GET /api/voicelink/sip-trunks — tries multiple paths; empty array if none match.
router.get("/sip-trunks", ...anyZenCall, async (_req, res) => {
    const candidates = [
        `${VL_RESELLER}/sip-trunks`,
        `${VL_RESELLER}/sip-trunk`,
        `${VL_RESELLER}/trunks`,
    ];
    for (const url of candidates) {
        try {
            const r = await resellerRequest("get", url);
            const raw = r?.data || r;
            return res.json({ data: Array.isArray(raw) ? raw : [] });
        } catch (err) {
            if (err?.statusCode !== 404) return vlErr(res, err);
        }
    }
    res.json({ data: [], manualRequired: true });
});

// ── Cloud Dialer: DID Import & Assignment ─────────────────────────────────────

// POST /api/voicelink/numbers/import
router.post("/numbers/import", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found." });

        const { address, auth_username, auth_password, phone_number, inbound_enabled = true, outbound_enabled = true } = req.body;
        if (!phone_number) return res.status(400).json({ message: "phone_number is required." });

        const did = await prisma.dIDNumber.upsert({
            where: { number: phone_number },
            update: {
                sipAddress:      address || null,
                authUsername:    auth_username || null,
                authPassword:    auth_password || null,
                inboundEnabled:  !!inbound_enabled,
                outboundEnabled: !!outbound_enabled,
                vlClientId:      dbClient.clientId,
                status:          "AVAILABLE",
            },
            create: {
                number:          phone_number,
                sipAddress:      address || null,
                authUsername:    auth_username || null,
                authPassword:    auth_password || null,
                inboundEnabled:  !!inbound_enabled,
                outboundEnabled: !!outbound_enabled,
                vlClientId:      dbClient.clientId,
                superAdminId:    req.user.userId,
                status:          "AVAILABLE",
            },
        });

        res.status(201).json({ message: "DID imported successfully.", did });
    } catch (err) {
        res.status(500).json({ message: "Failed to import DID.", error: err.message });
    }
});

// GET /api/voicelink/numbers/my-list — DIDs for this SUPER_ADMIN with assignment info
router.get("/numbers/my-list", ...clientLevel, async (req, res) => {
    try {
        const dids = await prisma.dIDNumber.findMany({
            where: { superAdminId: req.user.userId },
            include: { assignedToEmployee: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ data: dids });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch DID numbers." });
    }
});

// PATCH /api/voicelink/numbers/:id/assign — assign/unassign a DID to a CRM user
router.patch("/numbers/:id/assign", ...clientLevel, async (req, res) => {
    try {
        const { userId } = req.body; // null to unassign
        const did = await prisma.dIDNumber.findFirst({
            where: { id: req.params.id, superAdminId: req.user.userId },
        });
        if (!did) return res.status(404).json({ message: "DID not found." });

        if (userId) {
            const me = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { workspaceId: true } });
            const target = await prisma.user.findUnique({ where: { id: userId }, select: { workspaceId: true, name: true } });
            if (!target) return res.status(404).json({ message: "User not found." });
            if (target.workspaceId !== me.workspaceId) return res.status(403).json({ message: "User is not in your workspace." });
        }

        const updated = await prisma.dIDNumber.update({
            where: { id: req.params.id },
            data: {
                assignedToEmployeeId: userId || null,
                status: userId ? "ASSIGNED_TO_EMPLOYEE" : "AVAILABLE",
                assignedAt: userId ? new Date() : null,
            },
            include: { assignedToEmployee: { select: { id: true, name: true, email: true } } },
        });
        res.json({ message: userId ? "DID assigned successfully." : "DID unassigned.", did: updated });
    } catch (err) {
        res.status(500).json({ message: "Failed to update DID assignment.", error: err.message });
    }
});

// ── Cloud Dialer: Call Routing ────────────────────────────────────────────────

// GET /api/voicelink/call-routing — list routing rules for this client via VoiceLink
router.get("/call-routing", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found." });
        const data = await resellerRequest("get", `${VL_RESELLER}/call-routing`, { params: { client_id: dbClient.clientId } });
        res.json(data);
    } catch (err) {
        vlErr(res, err);
    }
});

// POST /api/voicelink/call-routing/setup — save trunk name locally + best-effort VL push
router.post("/call-routing/setup", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found." });

        const { did_id, sip_trunk_id, sip_trunk_name, for_inbound_call = 3, for_outbound_call = 3 } = req.body;
        const trunkRef = sip_trunk_name || sip_trunk_id;
        if (!did_id || !trunkRef) return res.status(400).json({ message: "did_id and sip_trunk_name are required." });

        // Local DB is the source of truth for routing.
        await prisma.dIDNumber.updateMany({
            where: {
                OR: [
                    { voicelinkDIDId: String(did_id), superAdminId: req.user.userId },
                    { id: String(did_id), superAdminId: req.user.userId },
                ],
            },
            data: { routingId: trunkRef },
        });

        // Best-effort push to VoiceLink (may 404 — not a failure).
        const payload = { client_id: dbClient.clientId, did_id, for_inbound_call, for_outbound_call };
        if (sip_trunk_name) payload.sip_trunk_name = sip_trunk_name;
        if (sip_trunk_id)   payload.sip_trunk_id   = sip_trunk_id;
        try {
            await resellerRequest("put", `${VL_RESELLER}/call-routing/${did_id}`, { data: payload });
        } catch {
            try {
                await resellerRequest("post", `${VL_RESELLER}/call-routing`, { data: payload });
            } catch (vlErr2) {
                console.warn("[VoiceLink] call-routing push failed (non-fatal):", vlErr2?.message);
            }
        }

        res.json({ message: "Call routing configured.", trunkRef });
    } catch (err) {
        res.status(500).json({ message: "Failed to configure routing.", error: err.message });
    }
});

// ── Cloud Dialer: SIP Credentials for Browser ─────────────────────────────────

// GET /api/voicelink/sip-credentials — WSS endpoint + SIP credentials for JsSIP
router.get("/sip-credentials", ...clientLevel, async (req, res) => {
    try {
        const dbClient = await prisma.voiceLinkClient.findUnique({ where: { userId: req.user.userId } });
        if (!dbClient) return res.status(404).json({ message: "No ZenCall account found." });

        // Keep this tenant's client session warm (best-effort).
        getClientToken(dbClient).catch((e) => console.warn("[VoiceLink] sip-credentials token warm failed:", e.message));

        res.json({
            wsUri:      "wss://app.voicelink.co.in:3300/ws",
            sipDomain:  "app.voicelink.co.in",
            username:   dbClient.username,
            password:   dbClient.password,
            techPrefix: "45454",
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch SIP credentials." });
    }
});

// ── Cloud Dialer: Call History ────────────────────────────────────────────────

// GET /api/voicelink/call-history
router.get("/call-history", ...anyZenCall, async (req, res) => {
    try {
        const { page = 1, limit = 50, userId, status, direction, did } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};

        if (req.user.role === "SUPER_ADMIN") {
            const me = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { workspaceId: true } });
            where.workspaceId = me.workspaceId;
        }
        if (userId)    where.userId    = userId;
        if (status)    where.status    = status;
        if (direction) where.direction = direction;
        if (did)       where.did       = did;

        const [events, total] = await Promise.all([
            prisma.zenCallEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: Number(limit) }),
            prisma.zenCallEvent.count({ where }),
        ]);
        res.json({ data: events, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch call history." });
    }
});

module.exports = router;
