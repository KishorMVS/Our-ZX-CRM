const crypto = require("crypto");
const axios = require("axios");
const prisma = require("../utils/prisma");
const { routeLead } = require("../utils/leadRouter");
const logActivity = require("../utils/activityLogger");
const calculateLeadScore = require("../utils/leadScorer");
const { sendLeadWelcomeEmail } = require("../services/emailService");

const PROD_URL = () => process.env.BACKEND_URL || null;
const LOCAL_URL = () => `http://localhost:${process.env.PORT || 5001}`;

// ── Token helpers ─────────────────────────────────────────────────────────────
const newToken = () => crypto.randomBytes(20).toString("hex");

const resolveWorkspace = async (captureToken) => {
    if (!captureToken) return null;
    const s = await prisma.companySettings.findFirst({
        where: { captureToken },
        select: { workspaceId: true },
    });
    return s?.workspaceId || null;
};

// ── Core lead creation (dedup → create → route → log) ────────────────────────
const createCapturedLead = async ({ workspaceId, name, email, phone, source, platform, notes, metadata = {} }) => {
    const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : null;
    const cleanEmail = email?.toLowerCase().trim() || null;
    const leadName = (name || "").trim() || cleanPhone || cleanEmail || "Unknown";

    // Workspace-scoped deduplication
    if (cleanPhone || cleanEmail) {
        const existing = await prisma.lead.findFirst({
            where: {
                workspaceId,
                OR: [
                    cleanPhone ? { phone: cleanPhone } : undefined,
                    cleanEmail ? { email: cleanEmail } : undefined,
                ].filter(Boolean),
            },
        });
        if (existing) {
            await logActivity({
                leadId: existing.id,
                action: "DUPLICATE_LEAD_CAPTURED",
                metadata: { source, platform, ...metadata },
            });
            return { lead: existing, isDuplicate: true };
        }
    }

    const lead = await prisma.lead.create({
        data: {
            name: leadName,
            email: cleanEmail,
            phone: cleanPhone,
            source: source || "WEBHOOK",
            enquiryType: "SERVICES",
            workspaceId,
            score: 0,
            category: "Cold Lead",
            tags: [platform?.toLowerCase().replace("_", " ") || "webhook"],
        },
    });

    if (notes) {
        await prisma.note.create({ data: { content: notes, leadId: lead.id } });
    }

    await logActivity({
        leadId: lead.id,
        action: "LEAD_CAPTURED_VIA_INTEGRATION",
        metadata: { source, platform, ...metadata },
    });

    // Increment integration stats (fire-and-forget, don't fail if integration not configured)
    if (platform && workspaceId) {
        prisma.integration.upsert({
            where: { workspaceId_platform: { workspaceId, platform } },
            create: { workspaceId, platform, isActive: true, leadsCaptures: 1, lastLeadAt: new Date() },
            update: { leadsCaptures: { increment: 1 }, lastLeadAt: new Date(), isActive: true },
        }).catch(() => { });
    }

    await routeLead(lead.id);

    // ── AI Outbound Call Pipeline (fire-and-forget) ──────────────────────────
    const { processNewLead } = require("../services/leadCallService");
    processNewLead(lead).catch(err =>
        console.error("[CallPipeline] Failed to queue lead for auto-call:", err.message)
    );

    // Send welcome email to lead (fire-and-forget — never fail the capture)
    if (lead.email) {
        const company = await prisma.companySettings.findFirst({ where: { workspaceId } }).catch(() => null);
        sendLeadWelcomeEmail({ lead, company, workspaceId }).catch(() => { });
    }

    return { lead, isDuplicate: false };
};

const DEFAULT_PLATFORMS = [
    "META_ADS",
    "GOOGLE_ADS",
    "GMAIL",
    "GOOGLE_SHEETS",
    "WEB_FORM",
    "WEBHOOK",
];

// ── GET /api/capture/config ───────────────────────────────────────────────────
const getConfig = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        if (!workspaceId) return res.status(400).json({ message: "No workspace associated with your account" });

        // Ensure default integrations exist
        for (const platform of DEFAULT_PLATFORMS) {
            await prisma.integration.upsert({
                where: { workspaceId_platform: { workspaceId, platform } },
                create: { workspaceId, platform, isConnected: false, isActive: false },
                update: {},
            });
        }

        let settings = workspaceId
            ? await prisma.companySettings.findFirst({ where: { workspaceId } })
            : null;

        if (!settings?.captureToken) {
            if (settings) {
                // Settings exist but no token — generate one
                await prisma.companySettings.updateMany({
                    where: { workspaceId },
                    data: { captureToken: newToken() },
                });
                settings = await prisma.companySettings.findFirst({ where: { workspaceId } });
            } else {
                // No settings yet — return ephemeral token (workspace setup still pending)
                settings = { captureToken: newToken() };
            }
        }

        const token = settings?.captureToken;
        const local = LOCAL_URL();

        // Determine host dynamically, checking for client-side and proxy headers
        let prod = process.env.BACKEND_URL || null;

        if (!prod) {
            // Try reading Referer or Origin headers sent by the client's browser
            const referer = req.headers.referer;
            const origin = req.headers.origin;
            const browserBase = origin || (referer ? new URL(referer).origin : null);

            if (browserBase && !browserBase.includes("localhost") && !browserBase.includes("127.0.0.1") && !browserBase.includes("::1")) {
                prod = browserBase;
            }
        }

        if (!prod) {
            // Fallback to proxy-forwarded host headers or requested host
            const forwardedHost = req.headers["x-forwarded-host"];
            const forwardedProto = req.headers["x-forwarded-proto"];
            const host = forwardedHost || req.get("host");
            const protocol = forwardedProto || req.protocol;
            const isLocalHost = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1");

            if (!isLocalHost) {
                prod = `${protocol}://${host}`;
            }
        }

        const makeWebhooks = (base) => ({
            universal: `${base}/api/capture/leads/${token}`,
            googleAds: `${base}/api/capture/google-ads/${token}`,
            googleSheets: `${base}/api/capture/google-sheets/${token}`,
            webForm: `${base}/api/capture/form/${token}`,
            metaVerify: `${base}/api/capture/meta/${token}`,
            metaReceive: `${base}/api/capture/meta/${token}`,
        });

        const integrations = await prisma.integration.findMany({
            where: workspaceId ? { workspaceId } : {},
        });

        const statsMap = {};
        integrations.forEach(i => { statsMap[i.platform] = i; });

        const totalCaptured = integrations.reduce((s, i) => s + (i.leadsCaptures || 0), 0);

        res.json({
            captureToken: token,
            totalCaptured,
            webhooks: makeWebhooks(prod || local),
            localWebhooks: makeWebhooks(local),
            prodWebhooks: prod ? makeWebhooks(prod) : null,
            integrations: statsMap,
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching capture config", error: err.message });
    }
};

// ── POST /api/capture/meta-config — save Meta page access token ───────────────
const saveMetaConfig = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { pageAccessToken, pageId } = req.body;
        if (!pageAccessToken) return res.status(400).json({ message: "pageAccessToken is required" });

        await prisma.integration.upsert({
            where: { workspaceId_platform: { workspaceId, platform: "META_ADS" } },
            create: { workspaceId, platform: "META_ADS", isActive: true, config: { pageAccessToken, pageId } },
            update: { isActive: true, config: { pageAccessToken, pageId } },
        });
        res.json({ message: "Meta configuration saved" });
    } catch (err) {
        res.status(500).json({ message: "Error saving Meta config", error: err.message });
    }
};

// ── POST /api/capture/toggle — enable/disable an integration ──────────────────
const toggleIntegration = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { platform } = req.body;
        if (!platform) return res.status(400).json({ message: "platform is required" });

        const result = await prisma.integration.upsert({
            where: { workspaceId_platform: { workspaceId, platform } },
            create: { workspaceId, platform, isActive: true },
            update: { isActive: { set: true } }, // toggle handled client-side; just ensure it exists
        });

        const updated = await prisma.integration.update({
            where: { id: result.id },
            data: { isActive: !result.isActive },
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: "Error toggling integration", error: err.message });
    }
};

// ── POST /api/capture/rotate — regenerate capture token ──────────────────────
const rotateToken = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const token = newToken();
        await prisma.companySettings.updateMany({
            where: workspaceId ? { workspaceId } : {},
            data: { captureToken: token },
        });
        res.json({ captureToken: token });
    } catch (err) {
        res.status(500).json({ message: "Error rotating token", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC WEBHOOK RECEIVERS (identified by captureToken in URL)
// ═════════════════════════════════════════════════════════════════════════════

// ── Universal — POST /api/capture/leads/:token ────────────────────────────────
const handleUniversal = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspace(req.params.token);
        if (!workspaceId) return res.status(404).json({ message: "Invalid capture token" });

        const { name, email, phone, source, notes } = req.body;
        const result = await createCapturedLead({
            workspaceId, name, email, phone,
            source: source || "WEBHOOK",
            platform: "WEBHOOK",
            notes,
        });
        res.status(result.isDuplicate ? 200 : 201).json({
            success: true, leadId: result.lead.id, isDuplicate: result.isDuplicate,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Google Ads Lead Form — POST /api/capture/google-ads/:token ───────────────
// Google Ads sends: { user_column_data: [{column_name, string_value}], campaign_name, ... }
const handleGoogleAds = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspace(req.params.token);
        if (!workspaceId) return res.status(404).json({ message: "Invalid capture token" });

        const { user_column_data = [], campaign_id, campaign_name, adgroup_id, creative_id } = req.body;

        const f = {};
        user_column_data.forEach(col => { f[col.column_name] = col.string_value; });

        const firstName = f["FIRST_NAME"] || "";
        const lastName = f["LAST_NAME"] || "";
        const name = f["FULL_NAME"] || `${firstName} ${lastName}`.trim();
        const email = f["EMAIL"] || f["EMAIL_ADDRESS"] || "";
        const phone = f["PHONE_NUMBER"] || f["PHONE"] || "";
        const company = f["COMPANY_NAME"] || "";
        const city = f["CITY"] || f["LOCATION"] || "";

        const notes = [
            campaign_name && `Campaign: ${campaign_name}`,
            company && `Company: ${company}`,
            city && `City: ${city}`,
        ].filter(Boolean).join(" | ");

        const result = await createCapturedLead({
            workspaceId, name, email, phone,
            source: "GOOGLE_ADS", platform: "GOOGLE_ADS",
            notes,
            metadata: { campaign_id, campaign_name, adgroup_id, creative_id },
        });
        res.status(result.isDuplicate ? 200 : 201).json({ success: true, leadId: result.lead.id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Google Sheets (Apps Script) — POST /api/capture/google-sheets/:token ─────
const handleGoogleSheets = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspace(req.params.token);
        if (!workspaceId) return res.status(404).json({ message: "Invalid capture token" });

        const { name, email, phone, notes, ...extra } = req.body;
        const extraNotes = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(" | ");

        const result = await createCapturedLead({
            workspaceId, name, email, phone,
            source: "GOOGLE_SHEETS", platform: "GOOGLE_SHEETS",
            notes: [notes, extraNotes].filter(Boolean).join(" | "),
        });
        res.status(result.isDuplicate ? 200 : 201).json({ success: true, leadId: result.lead.id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Web Form / Landing Page — POST /api/capture/form/:token ──────────────────
const handleWebForm = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspace(req.params.token);
        if (!workspaceId) return res.status(404).json({ message: "Invalid capture token" });

        const { name, email, phone, message, ...extra } = req.body;
        const notes = message || Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(" | ") || "";

        const result = await createCapturedLead({
            workspaceId, name, email, phone,
            source: "WEB_FORM", platform: "WEB_FORM",
            notes,
        });

        const redirectUrl = req.query.redirect;
        if (redirectUrl) return res.redirect(redirectUrl);

        res.status(result.isDuplicate ? 200 : 201).json({
            success: true, message: "Thank you! We'll be in touch soon.", leadId: result.lead.id,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Meta Lead Ads Verification — GET /api/capture/meta/:token ────────────────
const handleMetaVerify = async (req, res) => {
    const META_VERIFY = process.env.META_VERIFY_TOKEN || "zx_crm_meta_verify";
    const { "hub.mode": mode, "hub.challenge": challenge, "hub.verify_token": vt } = req.query;
    if (mode === "subscribe" && vt === META_VERIFY) return res.status(200).send(challenge);
    res.status(403).json({ message: "Verification failed" });
};

// ── Meta Lead Ads Receive — POST /api/capture/meta/:token ────────────────────
const handleMetaWebhook = async (req, res) => {
    res.status(200).send("OK"); // Always respond 200 immediately to Meta

    try {
        const workspaceId = await resolveWorkspace(req.params.token);
        if (!workspaceId || req.body.object !== "page") return;

        const integration = await prisma.integration.findFirst({
            where: { workspaceId, platform: "META_ADS" },
        });
        const pageToken = integration?.config?.pageAccessToken;
        if (!pageToken) return;

        for (const entry of req.body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== "leadgen") continue;
                const { leadgen_id, page_id } = change.value;
                try {
                    const { data: ld } = await axios.get(
                        `https://graph.facebook.com/v19.0/${leadgen_id}`,
                        { params: { access_token: pageToken } }
                    );
                    const fv = {};
                    (ld.field_data || []).forEach(f => { fv[f.name] = f.values?.[0]; });

                    await createCapturedLead({
                        workspaceId,
                        name: fv["full_name"] || `${fv["first_name"] || ""} ${fv["last_name"] || ""}`.trim(),
                        email: fv["email"] || "",
                        phone: fv["phone_number"] || "",
                        source: "META_ADS", platform: "META_ADS",
                        metadata: { leadgen_id, page_id, campaign_name: ld.campaign_name, ad_name: ld.ad_name },
                    });
                } catch (e) {
                    console.error("[Meta Webhook] fetch lead error:", e.message);
                }
            }
        }
    } catch (err) {
        console.error("[Meta Webhook] error:", err.message);
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS DIRECT SYNC (MANUAL FETCH)
// ═════════════════════════════════════════════════════════════════════════════

const extractSheetId = (input) => {
    if (!input) return null;
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
    if (match) return match[1];
    if (input.includes("http") || input.includes("docs.google.com")) return null;
    if (input.length >= 15 && /^[a-zA-Z0-9-_]+$/.test(input)) return input;
    return null;
};

const parseCSV = (content) => {
    const rows = [];
    let currentRow = [];
    let currentField = "";
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];
        if (char === '"' && inQuotes && nextChar === '"') {
            currentField += '"'; i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = "";
        } else if ((char === "\r" || char === "\n") && !inQuotes) {
            if (currentField || currentRow.length > 0) {
                currentRow.push(currentField.trim());
                rows.push(currentRow);
                currentField = "";
                currentRow = [];
            }
            if (char === "\r" && nextChar === "\n") i++;
        } else {
            currentField += char;
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
    }
    return rows;
};

const saveGoogleSheetsConfig = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { sheetLink, sheetName } = req.body;
        const sheetId = extractSheetId(sheetLink);

        if (!sheetId) return res.status(400).json({ message: "Invalid Google Sheet link or ID" });

        const integration = await prisma.integration.findFirst({
            where: { workspaceId, platform: "GOOGLE_SHEETS" }
        });

        let config = integration?.config || {};
        let sheets = config.sheets || [];

        // Migrate legacy single-sheet config if exists
        if (!config.sheets && config.sheetId) {
            sheets.push({ id: config.sheetId, link: config.sheetLink, name: "Primary Sheet" });
        }

        // Check if already exists
        if (sheets.some(s => s.id === sheetId)) {
            return res.status(400).json({ message: "This sheet is already connected" });
        }

        sheets.push({
            id: sheetId,
            link: sheetLink,
            name: sheetName || `Sheet ${sheets.length + 1}`,
            addedAt: new Date()
        });

        await prisma.integration.upsert({
            where: { workspaceId_platform: { workspaceId, platform: "GOOGLE_SHEETS" } },
            create: { workspaceId, platform: "GOOGLE_SHEETS", isActive: true, isConnected: true, config: { sheets } },
            update: { isActive: true, isConnected: true, config: { sheets } },
        });

        res.json({ message: "Google Sheet added successfully", sheets });
    } catch (err) {
        res.status(500).json({ message: "Error saving configuration", error: err.message });
    }
};

const removeGoogleSheetConfig = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { sheetId } = req.params;

        const integration = await prisma.integration.findFirst({
            where: { workspaceId, platform: "GOOGLE_SHEETS" }
        });

        if (!integration) {
            return res.status(404).json({ message: "Integration not found" });
        }

        const config = integration.config || {};
        let sheets = config.sheets || [];

        // Handle legacy migration on the fly if needed
        if (!config.sheets && config.sheetId) {
            sheets = [{ id: config.sheetId, link: config.sheetLink, name: "Primary Sheet" }];
        }

        const updatedSheets = sheets.filter(s => s.id !== sheetId);

        const updatedConfig = { ...config, sheets: updatedSheets };
        // If we just deleted the legacy sheet, also clear the legacy fields
        if (config.sheetId === sheetId) {
            delete updatedConfig.sheetId;
            delete updatedConfig.sheetLink;
        }

        await prisma.integration.update({
            where: { id: integration.id },
            data: {
                config: updatedConfig,
                isConnected: updatedSheets.length > 0
            }
        });

        res.json({ message: "Sheet removed successfully", sheets });
    } catch (err) {
        res.status(500).json({ message: "Error removing sheet", error: err.message });
    }
};

const syncGoogleSheetsLeads = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { id: integrationId } = req.params;

        const integration = await prisma.integration.findFirst({ where: { id: integrationId, workspaceId } });
        if (!integration || !integration.config) {
            return res.status(400).json({ message: "Google Sheet not configured" });
        }

        // Handle both new multi-sheet and legacy single-sheet formats
        const sheets = integration.config.sheets ||
            (integration.config.sheetId ? [{ id: integration.config.sheetId, name: "Primary" }] : []);

        if (sheets.length === 0) {
            return res.status(400).json({ message: "No sheets configured to sync" });
        }

        const results = { imported: 0, skipped: 0, failed: 0, sheetResults: [] };

        for (const sheet of sheets) {
            try {
                const response = await axios.get(`https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv`);
                const allRows = parseCSV(response.data);

                if (allRows.length < 2) {
                    results.sheetResults.push({ name: sheet.name, status: "Empty" });
                    continue;
                }

                const normalizeHeader = (h) => h.toLowerCase().replace(/[\s_\-\.#()]+/g, "").replace(/no$/, "").replace(/number$/, "").replace(/id$/, "");
                const ALIASES = {
                    name: ["name", "leadname", "fullname", "contactname", "customername", "firstname", "contact", "customer", "lead", "studentname", "candidatename", "clientname"],
                    email: ["email", "emailaddress", "emailid", "mail", "contactemail", "emailadd", "gmail", "outlook"],
                    phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "cell", "cellphone", "tel", "phn", "phoneno", "whatsapp"],
                    type: ["type", "enquirytype", "enquiry", "category", "producttype", "servicetype", "leadtype", "interest", "course", "service"],
                };

                const mapping = {};
                allRows[0].forEach((h, i) => {
                    const nh = normalizeHeader(h);
                    for (const [f, a] of Object.entries(ALIASES)) if (a.includes(nh)) mapping[f] = i;
                });

                let sheetImported = 0;
                for (let i = 1; i < allRows.length; i++) {
                    const values = allRows[i];
                    const name = mapping.name !== undefined ? values[mapping.name] : "";
                    const email = mapping.email !== undefined ? values[mapping.email] : "";
                    let phone = mapping.phone !== undefined ? values[mapping.phone] : "";
                    let type = mapping.type !== undefined ? values[mapping.type] : "SERVICES";

                    phone = phone ? phone.toString().replace(/\D/g, "").slice(-10) : "";
                    if (!name || !phone) { results.failed++; continue; }

                    const resData = await createCapturedLead({
                        workspaceId, name, email, phone,
                        source: "GOOGLE_SHEETS", platform: "GOOGLE_SHEETS",
                        notes: `Direct Sync | ${sheet.name} | ${type}`,
                    });

                    if (resData.isDuplicate) results.skipped++;
                    else { results.imported++; sheetImported++; }
                }
                results.sheetResults.push({ name: sheet.name, status: "Success", count: sheetImported });
            } catch (sheetErr) {
                results.sheetResults.push({ name: sheet.name, status: "Error", message: sheetErr.message });
                results.failed++;
            }
        }

        await prisma.integration.update({ where: { id: integrationId }, data: { lastSynced: new Date() } });
        res.json({ message: "Batch sync complete", results });
    } catch (err) {
        res.status(500).json({ message: "Sync failed", error: err.message });
    }
};

module.exports = {
    getConfig, saveMetaConfig, toggleIntegration, rotateToken,
    handleUniversal, handleGoogleAds, handleGoogleSheets, handleWebForm,
    handleMetaVerify, handleMetaWebhook,
    saveGoogleSheetsConfig, removeGoogleSheetConfig, syncGoogleSheetsLeads,
};
