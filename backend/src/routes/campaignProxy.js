const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");
const prisma = require("../utils/prisma");

// Configure multer for temporary file storage
const tempDir = "uploads/temp/";
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({ dest: tempDir });

/**
 * @openapi
 * /api/campaign-proxy/upload:
 *   post:
 *     summary: Upload campaign file
 *     description: Proxy to ZenXAI Voice API for uploading campaign CSVs. Includes phone normalization.
 *     tags:
 *       - Integrations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               assistant-id:
 *                 type: string
 *               phone-number:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded and campaign created
 *       400:
 *         description: Bad request (missing file or ID)
 */
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const assistantId = req.body["assistant-id"];
        const phoneNumber = req.body["phone-number"];

        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
        if (!assistantId) return res.status(400).json({ message: "Assistant ID is required" });

        let locallyExtractedLeads = [];
        // --- Start of Phone Normalization Logics ---
        try {
            if (req.file.mimetype === "text/csv" || req.file.originalname.endsWith(".csv")) {
                let content = fs.readFileSync(req.file.path, "utf8");
                const lines = content.split(/\r?\n/);
                if (lines.length > 0) {
                    const headers = lines[0].split(",");

                    let targetPhoneIdx = headers.findIndex(h => {
                        const ht = h.toLowerCase().trim().replace(/['"]/g, "");
                        if (ht.includes("assistant") || ht.includes("from")) return false;
                        return ht.includes("customer") || ht.includes("phone") || ht.includes("number") || ht.includes("mobile");
                    });

                    const phoneColumns = headers.reduce((acc, header, idx) => {
                        const h = header.toLowerCase().trim().replace(/['"]/g, "");
                        if (h.includes("phone") || h.includes("number") || h.includes("mobile")) acc.push(idx);
                        return acc;
                    }, []);

                    if (phoneColumns.length > 0) {
                        const normalizedLines = lines.map((line, lineIdx) => {
                            if (lineIdx === 0 || !line.trim()) return line;
                            const cols = line.split(",");

                            // Locally parse the customer phone, ignoring empty assistant columns
                            if (targetPhoneIdx !== -1 && cols[targetPhoneIdx]) {
                                let cPhone = cols[targetPhoneIdx].trim().replace(/['"]/g, "").replace(/\s+/g, "");
                                if (cPhone.startsWith("0")) cPhone = "+91" + cPhone.substring(1);
                                else if (cPhone.length === 10 && /^\d+$/.test(cPhone)) cPhone = "+91" + cPhone;
                                else if (/^\d+$/.test(cPhone) && !cPhone.startsWith("+")) cPhone = "+" + cPhone;
                                if (cPhone) locallyExtractedLeads.push({ "customer-phone": cPhone });
                            }

                            phoneColumns.forEach(idx => {
                                if (cols[idx]) {
                                    let phone = cols[idx].trim().replace(/['"]/g, "").replace(/\s+/g, "");
                                    if (phone.startsWith("0")) phone = "+91" + phone.substring(1);
                                    else if (phone.length === 10 && /^\d+$/.test(phone)) phone = "+91" + phone;
                                    else if (/^\d+$/.test(phone) && !phone.startsWith("+")) phone = "+" + phone;
                                    cols[idx] = phone;
                                }
                            });
                            return cols.join(",");
                        });
                        fs.writeFileSync(req.file.path, normalizedLines.join("\n"));
                    }
                }
            }
        } catch (normError) { console.error("Normalization failed:", normError); }

        const form = new FormData();
        form.append("assistant-id", assistantId);
        if (phoneNumber) form.append("phone-number", phoneNumber);
        form.append("file", fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const response = await axios.post("https://voice.zenxai.io/api/v1/call-campaigns/upload", form, {
            headers: { ...form.getHeaders(), Authorization: `Bearer ${platformToken}` },
        });

        const campaign = await prisma.campaign.create({
            data: {
                type: "CALL",
                assistantId: String(assistantId),
                status: "UPLOADED",
                imported: Math.max(locallyExtractedLeads.length, parseInt(response.data.imported) || 0),
                skipped: parseInt(response.data.skipped) || 0,
                results: (locallyExtractedLeads.length > 0) ? locallyExtractedLeads : (response.data.data || []),
                creatorId: String(req.user?.userId || req.user?.id || "unknown"),
                workspaceId: req.user?.workspaceId || null
            }
        });

        fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting temp file:", err); });
        res.json({ ...response.data, dbId: campaign.id });
    } catch (error) {
        if (req.file) fs.unlink(req.file.path, () => { });
        let status = error?.response?.status || 500;
        let msg = error?.response?.data?.message || error.message || "Upload failed";
        if (status === 401) { status = 400; msg = "INVALID VOICE TOKEN: " + msg; }
        res.status(status).json({ message: msg });
    }
});

/**
 * @openapi
 * /api/campaign-proxy/run:
 *   post:
 *     summary: Run a voice campaign
 *     description: Initiate calls for a campaign with optional scheduling and time windows.
 *     tags:
 *       - Integrations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dbId: { type: string }
 *               phone-number: { type: string, description: "From number" }
 *               assistantId: { type: string }
 *     responses:
 *       200:
 *         description: Campaign run started
 *       400:
 *         description: Invalid parameters
 */
router.post("/run", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const {
            dbId,
            googleSheetUrl, // 📥 Data ingestion from Google Sheets
            customerPhones,
            batchSize = 10,   // 📦 Batch processing with delays
            batchDelay = 5000,
            maxRetries = 3,   // 🔁 Retry system with limits
            scheduledTime,    // 🔄 Scheduled automation via triggers
            timeWindow        // ⏰ Time-based execution control (e.g. { start: "09:00", end: "18:00" })
        } = req.body;

        let assistantId = req.body.assistantId || req.body["assistant-id"];
        let fromPhoneNumber = req.body.fromPhoneNumber || req.body["phone-number"];
        let customerPhoneNumber = req.body.phoneNumber || req.body["customer-phone"];

        let finalPhones = [];

        // 📥 1. Data Ingestion from Google Sheets
        if (googleSheetUrl) {
            try {
                const match = googleSheetUrl.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                if (!match) return res.status(400).json({ message: "Invalid Google Sheets URL" });

                const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
                const response = await axios.get(exportUrl);
                const lines = response.data.split(/\r?\n/);

                if (lines.length > 0) {
                    const headers = lines[0].split(",");
                    const phoneIdx = headers.findIndex(h => {
                        const ht = h.toLowerCase().trim().replace(/['"]/g, "");
                        if (ht.includes("assistant") || ht.includes("from")) return false;
                        return ht.includes("customer") || ht.includes("phone") || ht.includes("number") || ht.includes("mobile");
                    });

                    if (phoneIdx !== -1) {
                        lines.slice(1).forEach(line => {
                            const cols = line.split(",");
                            if (cols[phoneIdx]) {
                                let phone = cols[phoneIdx].trim().replace(/['"]/g, "").replace(/\s+/g, "");
                                if (phone.startsWith("0")) phone = "+91" + phone.substring(1);
                                else if (phone.length === 10 && /^\d+$/.test(phone)) phone = "+91" + phone;
                                else if (/^\d+$/.test(phone) && !phone.startsWith("+")) phone = "+" + phone;
                                if (phone) finalPhones.push(phone);
                            }
                        });
                    }
                }
            } catch (sheetErr) {
                return res.status(400).json({ message: "Failed to fetch data from Google Sheets" });
            }
        }
        else if (dbId) {
            const campaign = await prisma.campaign.findUnique({ where: { id: dbId } });
            if (campaign) {
                if (!assistantId) assistantId = campaign.assistantId;
                if (Array.isArray(campaign.results)) {
                    finalPhones = campaign.results.map(lead => {
                        if (typeof lead === 'string') return lead;
                        return lead.phone || lead.phoneNumber || lead["customer-phone"] || lead.customerPhone || lead.to || lead.toNumber || lead.phoneNo;
                    }).filter(Boolean);
                }
            }
        }
        else if (Array.isArray(customerPhones) && customerPhones.length > 0) {
            finalPhones = customerPhones;
        } else if (customerPhoneNumber) {
            finalPhones = [customerPhoneNumber];
        }

        if (finalPhones.length === 0) {
            return res.status(400).json({ message: "No customer phone numbers found. Check your CSV or input." });
        }
        if (!fromPhoneNumber) {
            return res.status(400).json({ message: "Please select a From phone number (the registered outgoing number)." });
        }
        if (!assistantId) {
            return res.status(400).json({ message: "Assistant ID is required." });
        }

        if (dbId) {
            await prisma.campaign.update({
                where: { id: dbId },
                data: { status: scheduledTime ? "SCHEDULED" : "RUNNING" }
            });
        }

        // Background Processing Function
        const processCampaign = async () => {
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // ⏰ 4. Time-based execution control
            const isWithinTimeWindow = () => {
                if (!timeWindow || !timeWindow.start || !timeWindow.end) return true;
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const [startHr, startMin] = timeWindow.start.split(':').map(Number);
                const [endHr, endMin] = timeWindow.end.split(':').map(Number);
                return currentTime >= (startHr * 60 + (startMin || 0)) && currentTime <= (endHr * 60 + (endMin || 0));
            };

            const waitUntilNextWindow = async () => {
                if (!timeWindow || !timeWindow.start) return;
                return new Promise(resolve => {
                    const check = setInterval(() => {
                        if (isWithinTimeWindow()) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 60000);
                });
            };

            // 🔁 3. Retry system with limits
            const makeCallWithRetries = async (phone, retries = 0) => {
                try {
                    const payload = { phoneNumber: phone, fromPhoneNumber, selectedAssistant: assistantId };
                    const response = await axios.post("https://voice.zenxai.io/api/v1/phone/make_call", payload, {
                        headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" }
                    });

                    // Try to find the lead by phone number so we can link the CallLog
                    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
                    const lead = await prisma.lead.findFirst({
                        where: { phone: { contains: cleanPhone } }
                    });

                    if (lead) {
                        const sessionId = response.data?.call_id || response.data?.id || response.data?.session_id || null;
                        await prisma.callLog.create({
                            data: {
                                leadId: lead.id,
                                userId: req.user?.userId || req.user?.id || "system",
                                callType: "OUTBOUND",
                                callStatus: "INITIATED",
                                toNumber: phone,
                                sessionId: sessionId ? String(sessionId) : null,
                                agentNumber: fromPhoneNumber || null,
                                callDate: new Date()
                            }
                        });
                        console.log(`[campaign/run] CallLog created for ${phone}, lead: ${lead.id}, session: ${sessionId}`);
                    } else {
                        console.warn(`[campaign/run] No lead found in DB for phone: ${phone}`);
                    }

                    return response.data;
                } catch (error) {
                    if (retries < maxRetries) {
                        await sleep(2000);
                        return makeCallWithRetries(phone, retries + 1);
                    }
                    console.error(`[campaign/run] Call failed for ${phone} after ${maxRetries} retries.`);
                    return null;
                }
            };

            console.log(`[campaign/run] Starting background run for ${finalPhones.length} calls:`, finalPhones);

            // 📦 5. Sequential processing with delays
            for (let i = 0; i < finalPhones.length; i++) {
                if (!isWithinTimeWindow()) {
                    console.log(`[campaign/run] Outside time window, pausing...`);
                    await waitUntilNextWindow();
                }

                const phone = finalPhones[i];
                console.log(`[campaign/run] Calling ${phone} (${i + 1}/${finalPhones.length})`);

                // 📞 2. Automated calling via API
                await makeCallWithRetries(phone);

                // Delay between calls (using batchDelay for sequential delay)
                if (i < finalPhones.length - 1) {
                    console.log(`[campaign/run] Waiting ${batchDelay}ms before next call...`);
                    await sleep(Number(batchDelay));
                }
            }

            if (dbId) {
                await prisma.campaign.update({
                    where: { id: dbId },
                    data: { status: "COMPLETED" }
                });
                console.log(`[campaign/run] Campaign ${dbId} completed.`);
            }
        };

        // 🔄 6. Scheduled automation via triggers
        if (scheduledTime) {
            const delay = new Date(scheduledTime).getTime() - Date.now();
            if (delay > 0) {
                setTimeout(() => processCampaign().catch(console.error), delay);
                return res.json({ message: "Campaign scheduled for processing.", count: finalPhones.length });
            }
        }

        // Run immediately in background
        processCampaign().catch(console.error);
        res.json({ message: "Campaign run started successfully.", count: finalPhones.length, phonesQueued: finalPhones });

    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400;
        res.status(status).json({ message: error?.response?.data?.message || "Run failed" });
    }
});

/**
 * @openapi
 * /api/campaign-proxy/chat/send:
 *   post:
 *     summary: Send bulk chat messages
 *     description: Proxy to ZenXAI Chat API for bulk WhatsApp/message delivery.
 *     tags:
 *       - Integrations
 *     responses:
 *       200:
 *         description: Chat job created
 */
router.post("/chat/send", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");

        if (!platformToken) {
            return res.status(400).json({ message: "Platform token is required. Please check your settings." });
        }

        // Ensure token has Bearer prefix
        const authHeader = `Bearer ${platformToken}`;

        const response = await axios.post("https://chat.zenxai.io/api/bulk-messages/send", req.body, {
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json"
            }
        });

        // Track in Database
        await prisma.campaign.create({
            data: {
                type: "CHAT",
                name: req.body.name || "WhatsApp Campaign",
                assistantId: req.body.assistantId || "default",
                status: "PROCESSING",
                imported: req.body.recipientData?.length || 0,
                jobId: String(response.data.jobId || response.data.id || Date.now()),
                creatorId: String(req.user?.userId || req.user?.id || "unknown"),
                workspaceId: req.user?.workspaceId || null,
                results: req.body.recipientData || []
            }
        });

        res.json(response.data);
    } catch (error) {
        if (error.response) {
            console.error("Chat API error:", error.response.status, error.response.data);
        } else {
            console.error("Chat proxy error:", error.message);
        }

        let status = error?.response?.status || 500;
        let msg = error?.response?.data?.message || error.message || "Chat failed";
        if (status === 401) { status = 400; msg = "INVALID PERMANENT TOKEN: Check your Zenchat Settings."; }
        res.status(status).json({ message: msg, error: true });
    }
});

// Proxy for recent chat campaigns
router.get("/chat-campaigns/:assistantId", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token");
        if (!platformToken) return res.status(400).json({ message: "No token" });

        const response = await axios.get(`https://chat.zenxai.io/api/bulk-messages/assistant/${req.params.assistantId}`, {
            headers: { Authorization: `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        res.status(status).json({ message: "Failed to fetch campaigns", details: error?.response?.data });
    }
});

// Proxy for chat campaign job status
router.get("/chat-campaigns/status/:jobId", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token");
        if (!platformToken) return res.status(400).json({ message: "No token" });

        const response = await axios.get(`https://chat.zenxai.io/api/bulk-messages/status/${req.params.jobId}`, {
            headers: { Authorization: `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        res.status(status).json({ message: "Failed to fetch job status", details: error?.response?.data });
    }
});

/**
 * @openapi
 * /api/campaign-proxy/assistants:
 *   get:
 *     summary: Fetch available voice assistants
 *     tags:
 *       - Integrations
 *     responses:
 *       200:
 *         description: List of assistants
 */
router.get("/assistants", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.get("https://voice.zenxai.io/api/v1/assistants", {
            headers: { Authorization: `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        let msg = "Failed to fetch assistants";
        if (status === 401) { status = 400; msg = "INVALID TOKEN: Re-authorize in Settings."; }
        res.status(status).json({ message: msg });
    }
});

/**
 * @openapi
 * /api/campaign-proxy/registered-numbers:
 *   get:
 *     summary: Fetch registered telephony numbers
 *     tags:
 *       - Integrations
 *     responses:
 *       200:
 *         description: List of numbers
 */
router.get("/registered-numbers", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.get("https://voice.zenxai.io/api/v1/registered-numbers", {
            headers: { Authorization: `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400;
        res.status(status).json({ message: "Failed to fetch numbers" });
    }
});

/**
 * @openapi
 * /api/campaign-proxy/call-logs:
 *   get:
 *     summary: Fetch voice call logs
 *     description: Returns call records and automatically processes AI-qualified data into CRM leads.
 *     tags:
 *       - Integrations
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Call logs retrieved and processed
 */
router.get("/call-logs", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const { page = 1, limit = 50, callStatus } = req.query;

        const response = await axios.get("https://voice.zenxai.io/api/v1/call-logs", {
            headers: { Authorization: `Bearer ${platformToken}` },
            params: { page, limit, callStatus }
        });

        const logs = response.data?.data || [];

        // Process collected data synchronously before responding (so Leads page reflects updates)
        try {
            const calculateLeadScore = require("../utils/leadScorer");
            const logActivity = require("../utils/activityLogger");
            const processedInThisRequest = new Set(); // Prevent same lead being processed twice in one request

            for (const log of logs) {
                if (!log.collectedData) continue;

                const collectedData = typeof log.collectedData === 'string'
                    ? JSON.parse(log.collectedData)
                    : log.collectedData;

                const significantKeys = Object.keys(collectedData).filter(key =>
                    collectedData[key] &&
                    String(collectedData[key]).toLowerCase() !== "not available" &&
                    String(collectedData[key]).toLowerCase() !== "null" &&
                    String(collectedData[key]).toLowerCase() !== "n/a"
                );

                if (significantKeys.length === 0) continue;

                // Find lead by customerPhone
                const phoneField = log.customerPhone || log.customer_phone || log.toNumber || log.to;
                if (!phoneField) continue;

                const cleanPhone = phoneField.replace(/\D/g, "").slice(-10);
                if (cleanPhone.length < 10) continue;

                // Skip if we already processed this phone in this request batch
                const sessionKey = log.sessionId || log.id;
                if (processedInThisRequest.has(sessionKey)) continue;

                const lead = await prisma.lead.findFirst({
                    where: { phone: { contains: cleanPhone } }
                });

                if (!lead) continue;

                // Check if this specific call session was already processed in DB
                const alreadyProcessed = await prisma.activity.findFirst({
                    where: {
                        leadId: lead.id,
                        action: "AI_QUALIFIED",
                        metadata: { path: ["sessionId"], equals: sessionKey }
                    }
                });

                if (alreadyProcessed) continue;

                // Mark as processed in this request to prevent duplicates
                processedInThisRequest.add(sessionKey);

                // Update lead: +25 score, CONVERTED status, add tags
                const newScore = (lead.score || 0) + 25;
                const { category } = calculateLeadScore({ score: newScore });

                const currentTags = lead.tags || [];
                const newTags = [...currentTags];
                if (!newTags.includes("ai call qualified")) newTags.push("ai call qualified");
                if (category === "Warm Lead" || category === "Hot Lead") {
                    if (!newTags.includes("ai qualified")) newTags.push("ai qualified");
                }

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        score: newScore,
                        category,
                        status: "CONVERTED",
                        scoreUpdated: true,
                        tags: { set: newTags },
                        ...(collectedData.name &&
                            String(collectedData.name).toLowerCase() !== "not available" &&
                            (!lead.name || lead.name === "New Lead")
                            ? { name: collectedData.name } : {}),
                        notes: {
                            create: {
                                content: `[AI Data Collected]: ${JSON.stringify(collectedData)}`
                            }
                        }
                    }
                });

                await logActivity({
                    leadId: lead.id,
                    action: "AI_QUALIFIED",
                    metadata: {
                        sessionId: sessionKey,
                        collectedData,
                        pointsAdded: 25,
                        customerPhone: phoneField
                    }
                });

                console.log(`✅ [AI Qualified] ${lead.name} (${phoneField}) → score: ${newScore}, ${category}, tags: [${newTags.join(', ')}]`);
            }
        } catch (processErr) {
            console.error("[call-logs] Auto-process error:", processErr.message);
        }

        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400; // Prevent frontend auto-logout
        console.error("Call logs error:", error?.response?.data || error.message);
        res.status(status).json({ message: "Failed to fetch call logs" });
    }
});

// --- TOOL CONFIGURATION PROXIES ---

// Save tool configuration
router.post("/tool-config/save", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.post("https://voice.zenxai.io/api/v1/assistants/save-tool-config", req.body, {
            headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" }
        });
        res.status(201).json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400;
        res.status(status).json({ message: error?.response?.data?.message || "Failed to save tool config" });
    }
});

// Get tool config for assistant
router.get("/tool-config/:assistantId", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.get(`https://voice.zenxai.io/api/v1/assistants/tool-config/${req.params.assistantId}`, {
            headers: { Authorization: `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400;
        res.status(status).json({ message: "Failed to fetch tool configuration" });
    }
});

// Bulk tool config
router.post("/tool-config/bulk", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.post("https://voice.zenxai.io/api/v1/assistants/tool-configs/bulk", req.body, {
            headers: { Authorization: `Bearer ${platformToken}`, "Content-Type": "application/json" }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400;
        res.status(status).json({ message: "Failed to fetch bulk tool configs" });
    }
});

// Delete tool config
router.delete("/tool-config/:assistantId/:toolName", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.delete(`https://voice.zenxai.io/api/v1/assistants/tool-config/${req.params.assistantId}/${req.params.toolName}`, {
            headers: { Authorization: `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        if (status === 401) status = 400;
        res.status(status).json({ message: "Failed to delete tool config" });
    }
});


// GET conversations for an assistant
router.get("/conversations/assistant/:assistantId", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.get(`https://chat.zenxai.io/api/conversations/assistant/${req.params.assistantId}`, {
            headers: { Authorization: platformToken.startsWith("zen_") ? `Bearer ${platformToken}` : `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        let msg = "Failed to fetch conversations";
        if (status === 401) { status = 400; msg = "INVALID CHAT TOKEN: Re-authorize in Zenchat Settings."; }
        res.status(status).json({ message: msg });
    }
});

// GET messages for a conversation
router.get("/conversations/:conversationId/messages", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.get(`https://chat.zenxai.io/api/conversations/${req.params.conversationId}/messages`, {
            headers: { Authorization: platformToken.startsWith("zen_") ? `Bearer ${platformToken}` : `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        let msg = "Failed to fetch messages";
        if (status === 401) { status = 400; msg = "INVALID CHAT TOKEN: Re-authorize in Zenchat Settings."; }
        res.status(status).json({ message: msg });
    }
});

// POST message to a conversation (REPLY)
router.post("/conversations/:conversationId/messages", authMiddleware, async (req, res) => {
    try {
        const platformToken = req.get("x-platform-token") || req.get("Authorization")?.replace("Bearer ", "");
        const response = await axios.post(`https://chat.zenxai.io/api/conversations/${req.params.conversationId}/messages`, req.body, {
            headers: { Authorization: platformToken.startsWith("zen_") ? `Bearer ${platformToken}` : `Bearer ${platformToken}` }
        });
        res.json(response.data);
    } catch (error) {
        let status = error?.response?.status || 500;
        let msg = "Failed to send message";
        if (status === 401) { status = 400; msg = "INVALID CHAT TOKEN: Re-authorize in Zenchat Settings."; }
        res.status(status).json({ message: msg });
    }
});

// Get all campaigns for current workspace
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const campaigns = await prisma.campaign.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" }
        });
        res.json(campaigns);
    } catch (error) {
        res.json([]);
    }
});

module.exports = router;
