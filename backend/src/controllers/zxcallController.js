const axios = require("axios");
const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
const { getC2CQuota, clickToCall, listAllTelecmiUsers } = require("../services/telecmiService");

// ── Stale-request cleanup ─────────────────────────────────────────────────────
// Incomplete (unpaid) onboarding requests are discarded after 7 days, so the
// customer starts fresh and the platform dashboard stays clean. Paid/active
// requests are never auto-deleted.
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

async function purgeStaleRequests() {
    try {
        const cutoff = new Date(Date.now() - STALE_AFTER_MS);
        const stale = await prisma.zXCallRequest.findMany({
            where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
            select: { id: true, gstCertificate: true, incorporationCertificate: true, aadharCard: true },
        });
        if (!stale.length) return;

        // Best-effort removal of the orphaned uploaded files
        for (const r of stale) {
            [r.gstCertificate, r.incorporationCertificate, r.aadharCard].forEach((p) => {
                if (!p) return;
                fs.unlink(path.join(__dirname, "../..", p), () => {});
            });
        }
        await prisma.zXCallRequest.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    } catch (err) {
        console.error("[ZXCall] purgeStaleRequests error:", err.message);
    }
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PRICE_PER_CHANNEL = 1500;   // ₹ per channel (before GST)
const PRICE_PER_AGENT   = 400;    // ₹ per number/agent (before GST)
const GST_RATE          = 0.18;   // 18%

function priceFor(channels, agents) {
    const ch = Math.max(0, Number(channels) || 0);
    const ag = Math.max(0, Number(agents) || 0);
    const base = ch * PRICE_PER_CHANNEL + ag * PRICE_PER_AGENT;
    const gst = Math.round(base * GST_RATE * 100) / 100;
    const total = Math.round((base + gst) * 100) / 100;
    return {
        base, gst, total,
        pricePerChannel: PRICE_PER_CHANNEL,
        pricePerAgent: PRICE_PER_AGENT,
        gstRate: GST_RATE,
    };
}

// ── Cashfree config ─────────────────────────────────────────────────────────
const CASHFREE_ID     = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_SECRET = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_BASE   =
    process.env.CASHFREE_ENV === "PRODUCTION"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg";
const cfHeaders = {
    "x-api-version":   "2023-08-01",
    "x-client-id":     CASHFREE_ID,
    "x-client-secret": CASHFREE_SECRET,
    "Content-Type":    "application/json",
};

// ── POST /api/zxcall/onboard ──────────────────────────────────────────────────
// multipart/form-data with 3 file fields handled by route middleware
exports.onboard = async (req, res) => {
    try {
        const { gstNumber, agents, channels, users } = req.body;

        if (!gstNumber) {
            return res.status(400).json({ message: "GST number is required." });
        }
        const nAgents = Number(agents);
        const nChannels = Number(channels);
        const nUsers = Number(users);
        if (!nAgents || nAgents < 1 || !nChannels || nChannels < 1) {
            return res.status(400).json({ message: "Agents and channels must be at least 1." });
        }
        if (!nUsers || nUsers < 1) {
            return res.status(400).json({ message: "Number of users must be at least 1." });
        }

        // Company/contact details are derived from the account, not collected in the form
        let companyName = "", contactName = "", email = "", phone = "";
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { name: true, email: true, phone: true },
            });
            contactName = user?.name || "";
            email = user?.email || "";
            phone = user?.phone || "";
            if (req.user.workspaceId) {
                const cs = await prisma.companySettings.findUnique({
                    where: { workspaceId: req.user.workspaceId },
                    select: { companyName: true, email: true, phone: true },
                });
                if (cs) {
                    companyName = cs.companyName || companyName;
                    email = cs.email || email;
                    phone = cs.phone || phone;
                }
            }
        } catch { /* fall back to empty — dashboard still resolves via CompanySettings */ }

        const files = req.files || {};
        const filePath = (f) => (f && f[0] ? `/uploads/zxcall/${f[0].filename}` : null);
        const gstCertificate           = filePath(files.gstCertificate);
        const incorporationCertificate = filePath(files.incorporationCertificate);
        const aadharCard               = filePath(files.aadharCard);

        if (!gstCertificate || !incorporationCertificate || !aadharCard) {
            return res.status(400).json({ message: "All three documents are required." });
        }

        const pricing = priceFor(nChannels, nAgents);

        const request = await prisma.zXCallRequest.create({
            data: {
                workspaceId:   req.user.workspaceId || null,
                requestedById: req.user.userId || null,
                gstNumber, companyName, contactName, email, phone,
                gstCertificate, incorporationCertificate, aadharCard,
                agents: nAgents,
                channels: nChannels,
                userLimit: nUsers,
                baseAmount:  pricing.base,
                gstAmount:   pricing.gst,
                totalAmount: pricing.total,
                status: "PENDING_PAYMENT",
            },
        });

        return res.json({ requestId: request.id, pricing });
    } catch (error) {
        console.error("[ZXCall] Onboard error:", error.message);
        return res.status(500).json({ message: "Failed to submit onboarding details" });
    }
};

// ── POST /api/zxcall/create-order ─────────────────────────────────────────────
exports.createOrder = async (req, res) => {
    try {
        const { requestId } = req.body;
        const request = await prisma.zXCallRequest.findUnique({ where: { id: requestId } });
        if (!request) return res.status(404).json({ message: "Onboarding request not found." });
        if (request.status !== "PENDING_PAYMENT") {
            return res.status(400).json({ message: "This request has already been paid." });
        }

        // Amount is recomputed server-side — never trust the client
        const pricing = priceFor(request.channels, request.agents);
        const orderId = `ZXCALL_${Date.now()}_${request.id.slice(0, 8)}`;

        const payload = {
            order_amount:   pricing.total,
            order_currency: "INR",
            order_id:       orderId,
            customer_details: {
                customer_id:    `cust_${req.user.userId}`,
                customer_name:  request.contactName || "ZX Call Customer",
                customer_email: request.email || "user@zenxai.io",
                customer_phone: request.phone || "9999999999",
            },
            order_meta: {
                return_url: `${req.body.returnUrl || (process.env.FRONTEND_URL || "http://localhost:5173") + "/zxcall/onboard"}?order_id={order_id}`,
            },
            order_note: `ZX Call — ${request.channels} channel(s), ${request.agents} agent(s)`,
        };

        const response = await axios.post(`${CASHFREE_BASE}/orders`, payload, { headers: cfHeaders });

        await prisma.zXCallRequest.update({ where: { id: request.id }, data: { orderId } });

        return res.json({
            payment_session_id: response.data.payment_session_id,
            order_id: orderId,
            requestId: request.id,
            pricing,
            mode: process.env.CASHFREE_ENV === "PRODUCTION" ? "production" : "sandbox",
        });
    } catch (error) {
        console.error("[ZXCall] Create order error:", error?.response?.data || error.message);
        return res.status(500).json({
            message: "Failed to create payment order",
            error: error?.response?.data?.message || error.message,
        });
    }
};

// ── POST /api/zxcall/verify ───────────────────────────────────────────────────
exports.verify = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ message: "orderId is required" });

        const request = await prisma.zXCallRequest.findFirst({ where: { orderId } });
        if (!request) return res.status(404).json({ message: "Request for this order not found." });

        // Already processed — return success idempotently
        if (request.status !== "PENDING_PAYMENT") {
            return res.json({ success: true, status: request.status, paidAt: request.paidAt });
        }

        const response = await axios.get(`${CASHFREE_BASE}/orders/${orderId}/payments`, { headers: cfHeaders });
        const payments = response.data || [];
        const paid = payments.find((p) => p.payment_status === "SUCCESS");

        if (!paid) {
            return res.json({ success: false, status: payments[0]?.payment_status || "PENDING" });
        }

        const updated = await prisma.zXCallRequest.update({
            where: { id: request.id },
            data: {
                status: "PAID",
                paidAt: new Date(),
                paymentId: String(paid.cf_payment_id || ""),
            },
        });

        // Notify all platform owners
        try {
            const owners = await prisma.user.findMany({
                where: { role: "PLATFORM_OWNER" },
                select: { id: true },
            });
            if (owners.length) {
                await prisma.notification.createMany({
                    data: owners.map((o) => ({
                        userId: o.id,
                        title: "New ZX Call request",
                        message: `${updated.companyName || "A company"} paid ₹${updated.totalAmount} for ZX Call (${updated.channels} channels, ${updated.agents} agents). Provision within 48 hours.`,
                        type: "ZXCALL",
                        link: "/platform/zxcall",
                    })),
                });
            }
        } catch (notifyErr) {
            console.error("[ZXCall] Notify owners failed:", notifyErr.message);
        }

        return res.json({ success: true, status: "PAID", paidAt: updated.paidAt });
    } catch (error) {
        console.error("[ZXCall] Verify error:", error?.response?.data || error.message);
        return res.status(500).json({ message: "Failed to verify payment" });
    }
};

// ── GET /api/zxcall/my ────────────────────────────────────────────────────────
// Latest request for the caller's workspace (drives the unlock screen)
exports.myRequest = async (req, res) => {
    try {
        await purgeStaleRequests();
        const request = await prisma.zXCallRequest.findFirst({
            where: req.user.workspaceId
                ? { workspaceId: req.user.workspaceId }
                : { requestedById: req.user.userId },
            orderBy: { createdAt: "desc" },
        });
        return res.json({ request: request || null });
    } catch (error) {
        console.error("[ZXCall] myRequest error:", error.message);
        return res.status(500).json({ message: "Failed to load request" });
    }
};

// ── POST /api/zxcall/click2call ───────────────────────────────────────────────
// Initiates a TeleCMI click-to-call from the logged-in C2C agent to a number.
exports.click2call = async (req, res) => {
    try {
        const { to } = req.body;
        if (!to) return res.status(400).json({ message: "Destination number is required." });

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { isC2C: true, telecmiAgentId: true },
        });
        if (!user?.isC2C || !user.telecmiAgentId) {
            return res.status(400).json({ message: "You are not provisioned for C2C calling." });
        }

        // Normalise the destination to 12-digit international format for matching later
        const digits = String(to).replace(/\D/g, "");
        const formattedTo = digits.length === 10 ? `91${digits}` : digits;

        // Auto-match lead by last 10 digits of phone, scoped to workspace, newest first
        const last10 = digits.slice(-10);
        const lead = last10
            ? await prisma.lead.findFirst({
                  where: {
                      phone: { endsWith: last10 },
                      workspaceId: req.user.workspaceId,
                  },
                  orderBy: { createdAt: "desc" },
                  select: { id: true },
              })
            : null;

        // Create a call log so the CDR webhook can match it when the call ends
        const callLog = await prisma.callLog.create({
            data: {
                leadId:      lead?.id || null,
                userId:      req.user.userId,
                callType:    "OUTBOUND",
                callStatus:  "INITIATED",
                agentNumber: user.telecmiAgentId,
                toNumber:    formattedTo,
                duration:    0,
            },
        });

        const result = await clickToCall({
            workspaceId: req.user.workspaceId,
            agentUserId: user.telecmiAgentId,
            toNumber: to,
        });
        return res.json({ success: true, callLogId: callLog.id, ...result });
    } catch (error) {
        console.error("[ZXCall] click2call error:", error.message);
        return res.status(500).json({ message: error.message || "Failed to initiate call" });
    }
};

// ── GET /api/zxcall/c2c-usage ─────────────────────────────────────────────────
// How many C2C users this workspace may create vs. has already created.
exports.c2cUsage = async (req, res) => {
    try {
        const usage = await getC2CQuota(req.user.workspaceId);
        return res.json(usage);
    } catch (error) {
        console.error("[ZXCall] c2cUsage error:", error.message);
        return res.status(500).json({ message: "Failed to load C2C usage" });
    }
};

// ── GET /api/platform/zxcall-requests ─────────────────────────────────────────
exports.listRequests = async (req, res) => {
    try {
        await purgeStaleRequests();
        const requests = await prisma.zXCallRequest.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                workspace: {
                    select: {
                        id: true, name: true,
                        companySettings: {
                            select: {
                                companyName: true, email: true, phone: true,
                                address: true, city: true, state: true, pincode: true,
                            },
                        },
                    },
                },
            },
        });

        const enriched = requests.map((r) => {
            const cs = r.workspace?.companySettings;
            const addr = cs
                ? [cs.address, cs.city, cs.state, cs.pincode].filter(Boolean).join(", ")
                : "";
            return {
                ...r,
                company: {
                    name: cs?.companyName || r.workspace?.name || r.companyName || "—",
                    email: cs?.email || r.email || "—",
                    phone: cs?.phone || r.phone || "—",
                    address: addr || "—",
                },
            };
        });

        const pending = enriched.filter((r) => r.status === "PAID").length;
        return res.json({ requests: enriched, pendingProvision: pending });
    } catch (error) {
        console.error("[ZXCall] listRequests error:", error.message);
        return res.status(500).json({ message: "Failed to load ZX Call requests" });
    }
};

// ── PATCH /api/platform/zxcall-requests/:id/activate ──────────────────────────
exports.activateRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { appId, secretKey, didNumber } = req.body;

        if (!appId?.trim() || !secretKey?.trim() || !didNumber?.trim()) {
            return res.status(400).json({ message: "App ID, secret key and DID number are all required." });
        }

        const request = await prisma.zXCallRequest.findUnique({ where: { id } });
        if (!request) return res.status(404).json({ message: "Request not found." });
        if (request.status !== "PAID") {
            return res.status(400).json({ message: "Only paid requests can be activated." });
        }
        const updated = await prisma.zXCallRequest.update({
            where: { id },
            data: {
                status: "ACTIVE",
                activatedAt: new Date(),
                appId: appId.trim(),
                secretKey: secretKey.trim(),
                didNumber: didNumber.trim(),
            },
        });
        // Notify the requester that their ZX Call account is live
        if (updated.requestedById) {
            await prisma.notification.create({
                data: {
                    userId: updated.requestedById,
                    title: "ZX Call activated",
                    message: "Your ZX Call click-to-call account is now active.",
                    type: "ZXCALL",
                    link: "/dashboard",
                },
            }).catch(() => {});
        }
        return res.json({ request: updated });
    } catch (error) {
        console.error("[ZXCall] activateRequest error:", error.message);
        return res.status(500).json({ message: "Failed to activate request" });
    }
};

// ── GET /api/zxcall/telecmi-users ─────────────────────────────────────────────
// Lists all TeleCMI agents cross-referenced with CRM users. SUPER_ADMIN only.
exports.telecmiUsers = async (req, res) => {
    try {
        const { workspaceId, role } = req.user;
        if (role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "SUPER_ADMIN access required." });
        }

        const [agents, crmUsers, quota] = await Promise.all([
            listAllTelecmiUsers(workspaceId),
            prisma.user.findMany({
                where: { workspaceId, isC2C: true },
                select: { id: true, name: true, email: true, role: true, telecmiAgentId: true, telecmiUserId: true, isActive: true },
            }),
            getC2CQuota(workspaceId),
        ]);

        // Build a map: telecmiAgentId → CRM user
        const agentMap = {};
        crmUsers.forEach(u => { if (u.telecmiAgentId) agentMap[u.telecmiAgentId] = u; });

        const merged = agents.map(agent => ({
            ...agent,
            crmUser: agentMap[agent.agent_id] || null,
        }));

        return res.json({ agents: merged, quota });
    } catch (error) {
        console.error("[ZXCall] telecmiUsers error:", error.message);
        return res.status(500).json({ message: error.message || "Failed to fetch TeleCMI users" });
    }
};
