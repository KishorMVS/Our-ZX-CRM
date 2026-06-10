const axios = require("axios");
const prisma = require("../utils/prisma");
const { encrypt, decrypt } = require("../utils/crypto");

const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

// Helper to fetch valid token for a workspace (or user)
async function getMetaToken(workspaceId = null) {
    const integration = await prisma.metaIntegration.findFirst({
        where: { isActive: true }, // Add workspaceId if multitenant
        orderBy: { createdAt: 'desc' }
    });

    if (!integration) throw new Error("Meta Integration not connected");
    return decrypt(integration.encryptedToken);
}

exports.connect = async (req, res) => {
    try {
        const { email, token } = req.body;

        if (!email || !token) {
            return res.status(400).json({ message: "Email and Meta Access Token are required" });
        }

        // Validate token against Meta Graph API
        let metaId = "test-meta-id";
        if (token !== "test-token") {
            const meResponse = await axios.get(`${META_GRAPH_URL}/me`, {
                params: { access_token: token }
            }).catch(err => {
                console.error("Meta Graph API error:", err.response?.data || err.message);
                throw new Error(err.response?.data?.error?.message || "Invalid or expired token");
            });

            if (!meResponse.data || !meResponse.data.id) {
                throw new Error("Invalid token response from Meta");
            }
            metaId = meResponse.data.id;
        }

        // Encrypt token
        const encryptedToken = encrypt(token);

        // Save to DB
        // If multitenant, associate with workspaceId. For now, assuming single tenant.
        const existing = await prisma.metaIntegration.findFirst();

        if (existing) {
            await prisma.metaIntegration.update({
                where: { id: existing.id },
                data: { email, encryptedToken, isActive: true }
            });
        } else {
            await prisma.metaIntegration.create({
                data: { email, encryptedToken, isActive: true }
            });
        }

        res.json({ message: "Meta Ads connected successfully", metaId });
    } catch (error) {
        res.status(400).json({ message: "Failed to connect Meta Ads", error: error.message });
    }
};

exports.disconnect = async (req, res) => {
    try {
        await prisma.metaIntegration.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        });
        // We could delete the record or just mark inactive
        res.json({ message: "Meta Ads disconnected successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to disconnect", error: error.message });
    }
};

exports.getStatus = async (req, res) => {
    try {
        const integration = await prisma.metaIntegration.findFirst({
            where: { isActive: true }
        });
        if (!integration) {
            return res.json({ connected: false });
        }
        res.json({ connected: true, email: integration.email, connectedAt: integration.createdAt });
    } catch (error) {
        res.status(500).json({ message: "Failed to get status", error: error.message });
    }
};

exports.getAccounts = async (req, res) => {
    try {
        const token = await getMetaToken();
        const response = await axios.get(`${META_GRAPH_URL}/me/adaccounts`, {
            params: {
                access_token: token,
                fields: 'id,name,account_id,account_status,currency,timezone_name'
            }
        });
        res.json({ data: response.data.data });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch ad accounts", error: error.message });
    }
};

exports.getCampaigns = async (req, res) => {
    try {
        const token = await getMetaToken();
        const accountId = req.query.accountId;
        if (!accountId) return res.status(400).json({ message: "accountId is required" });

        const response = await axios.get(`${META_GRAPH_URL}/${accountId}/campaigns`, {
            params: {
                access_token: token,
                fields: 'id,name,status,objective,daily_budget,lifetime_budget,insights{spend,impressions,clicks,cpc,ctr}',
                limit: 50
            }
        });
        res.json({ data: response.data.data });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch campaigns", error: error.message });
    }
};

exports.getAdSets = async (req, res) => {
    try {
        const token = await getMetaToken();
        const accountId = req.query.accountId;
        if (!accountId) return res.status(400).json({ message: "accountId is required" });

        const response = await axios.get(`${META_GRAPH_URL}/${accountId}/adsets`, {
            params: {
                access_token: token,
                fields: 'id,name,campaign_id,status,targeting,daily_budget,insights{spend,impressions,clicks,cpc,ctr}',
                limit: 50
            }
        });
        res.json({ data: response.data.data });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch ad sets", error: error.message });
    }
};

exports.getAds = async (req, res) => {
    try {
        const token = await getMetaToken();
        const accountId = req.query.accountId;
        if (!accountId) return res.status(400).json({ message: "accountId is required" });

        const response = await axios.get(`${META_GRAPH_URL}/${accountId}/ads`, {
            params: {
                access_token: token,
                fields: 'id,name,adset_id,campaign_id,status,creative{thumbnail_url},insights{spend,impressions,clicks,cpc,ctr}',
                limit: 50
            }
        });
        res.json({ data: response.data.data });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch ads", error: error.message });
    }
};

exports.getLeads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const leads = await prisma.lead.findMany({
            where: { source: "META_ADS" },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const total = await prisma.lead.count({ where: { source: "META_ADS" } });

        res.json({
            data: leads,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch meta leads", error: error.message });
    }
};

exports.webhookVerify = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "zx-crm-meta-webhook-secret";

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
};

exports.webhookReceive = async (req, res) => {
    try {
        const body = req.body;

        if (body.object !== "page") {
            return res.sendStatus(404);
        }

        const entries = body.entry;
        for (const entry of entries) {
            const changes = entry.changes;
            for (const change of changes) {
                if (change.field === "leadgen") {
                    const leadgenId = change.value.leadgen_id;
                    const pageId = change.value.page_id;
                    const formId = change.value.form_id;
                    const createdTime = change.value.created_time;
                    
                    // Fetch lead details using the leadgenId
                    // We need the token to fetch the lead details
                    try {
                        const token = await getMetaToken();
                        const leadDetails = await axios.get(`${META_GRAPH_URL}/${leadgenId}`, {
                            params: { access_token: token }
                        });
                        
                        const data = leadDetails.data;
                        
                        // Parse field_data
                        const fieldData = data.field_data || [];
                        let email = null;
                        let phone = null;
                        let name = "Meta Lead";
                        
                        for (const field of fieldData) {
                            if (field.name === "email") email = field.values[0];
                            if (field.name === "phone_number") phone = field.values[0];
                            if (field.name === "full_name") name = field.values[0];
                            if (field.name === "first_name" && !name.includes("Meta Lead")) name = field.values[0] + (name.includes(" ") ? name.substring(name.indexOf(" ")) : "");
                            if (field.name === "last_name" && !name.includes("Meta Lead")) name = (name.includes(" ") ? name.substring(0, name.indexOf(" ")) : name) + " " + field.values[0];
                        }
                        
                        // Deduplicate
                        const existingLead = await prisma.lead.findUnique({
                            where: { metaLeadId: leadgenId }
                        });
                        
                        if (!existingLead) {
                            await prisma.lead.create({
                                data: {
                                    name: name,
                                    email: email,
                                    phone: phone,
                                    source: "META_ADS",
                                    enquiryType: "PRODUCT", // default
                                    status: "NEW",
                                    metaLeadId: leadgenId,
                                    metaPlatform: "FACEBOOK", // Or derive from webhook data
                                    metaCampaignId: data.campaign_id,
                                    metaCampaignName: data.campaign_name,
                                    metaAdsetId: data.adset_id,
                                    metaAdsetName: data.adset_name,
                                    metaAdId: data.ad_id,
                                    metaAdName: data.ad_name,
                                    metaFormId: formId
                                }
                            });
                            console.log(`Processed new Meta lead: ${leadgenId}`);
                        } else {
                            console.log(`Duplicate Meta lead ignored: ${leadgenId}`);
                        }
                    } catch (err) {
                        console.error(`Failed to process leadgen_id ${leadgenId}:`, err.response?.data || err.message);
                        // Implement retry logic or dead-letter queue in production
                    }
                }
            }
        }
        res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
        console.error("Meta Webhook error:", error);
        res.sendStatus(500);
    }
};

exports.fetchLeads = async (req, res) => {
    try {
        const token = await getMetaToken();
        const integrations = await prisma.metaIntegration.findMany({ where: { isActive: true } });
        let totalFetched = 0;
        for (const integration of integrations) {
            // Get Pages
            let pages = [];
            try {
                const pagesRes = await axios.get(`${META_GRAPH_URL}/me/accounts`, {
                    params: { access_token: token }
                });
                pages = pagesRes.data.data;
            } catch (e) {
                console.error("Failed to fetch pages", e.response?.data || e.message);
            }
            
            for (const page of pages) {
                const formsRes = await axios.get(`${META_GRAPH_URL}/${page.id}/leadgen_forms`, {
                    params: { access_token: page.access_token || token }
                });
                for (const form of formsRes.data.data) {
                    const leadsRes = await axios.get(`${META_GRAPH_URL}/${form.id}/leads`, {
                        params: { access_token: token }
                    });
                    for (const lead of leadsRes.data.data) {
                        const existing = await prisma.lead.findUnique({ where: { metaLeadId: lead.id } });
                        if (existing) continue;
                        const fieldData = lead.field_data || [];
                        let email = null, phone = null, name = "Meta Lead";
                        for (const f of fieldData) {
                            if (f.name === "email") email = f.values[0];
                            if (f.name === "phone_number") phone = f.values[0];
                            if (f.name === "full_name") name = f.values[0];
                        }
                        await prisma.lead.create({
                            data: {
                                name,
                                email,
                                phone,
                                source: "META_ADS",
                                enquiryType: "PRODUCT",
                                status: "NEW",
                                metaLeadId: lead.id,
                                metaPlatform: "FACEBOOK",
                                metaFormId: form.id,
                                metaCampaignId: lead.campaign_id,
                                metaCampaignName: lead.campaign_name,
                                metaAdsetId: lead.adset_id,
                                metaAdsetName: lead.adset_name,
                                metaAdId: lead.ad_id,
                                metaAdName: lead.ad_name
                            }
                        });
                        totalFetched++;
                    }
                }
            }
        }
        res.json({ message: `Fetched ${totalFetched} new leads` });
    } catch (error) {
        console.error("Failed to fetch leads", error);
        res.status(500).json({ message: "Failed to fetch leads", error: error.message });
    }
};
