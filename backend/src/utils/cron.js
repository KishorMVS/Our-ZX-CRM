const cron = require("node-cron");
const prisma = require("./prisma");
const axios = require("axios");
const { decrypt } = require("./crypto");

const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

const startCronJobs = () => {
    // Run every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
        console.log("Running Meta Ads polling fallback cron job...");
        try {
            const integrations = await prisma.metaIntegration.findMany({
                where: { isActive: true }
            });

            for (const integration of integrations) {
                const token = decrypt(integration.encryptedToken);
                
                // Typically you'd fetch ad accounts, then forms, then leads.
                // Simplified version fetching ad account leads or form leads depending on permissions.
                // Assuming we can fetch pages -> forms -> leads
                
                try {
                    // Get pages connected to the user
                    const pagesRes = await axios.get(`${META_GRAPH_URL}/me/accounts`, {
                        params: { access_token: token }
                    });
                    
                    for (const page of pagesRes.data.data) {
                        const formsRes = await axios.get(`${META_GRAPH_URL}/${page.id}/leadgen_forms`, {
                            params: { access_token: page.access_token || token }
                        });
                        
                        for (const form of formsRes.data.data) {
                            // Get leads for form created in last 24h
                            const since = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
                            const leadsRes = await axios.get(`${META_GRAPH_URL}/${form.id}/leads`, {
                                params: { 
                                    access_token: token,
                                    filtering: `[{field:"time_created",operator:"GREATER_THAN",value:${since}}]`
                                }
                            });
                            
                            for (const lead of leadsRes.data.data) {
                                const leadgenId = lead.id;
                                
                                // Deduplicate
                                const existing = await prisma.lead.findUnique({
                                    where: { metaLeadId: leadgenId }
                                });
                                
                                if (!existing) {
                                    // Parse field data
                                    const fieldData = lead.field_data || [];
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
                                    
                                    await prisma.lead.create({
                                        data: {
                                            name: name,
                                            email: email,
                                            phone: phone,
                                            source: "META_ADS",
                                            enquiryType: "PRODUCT",
                                            status: "NEW",
                                            metaLeadId: leadgenId,
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
                                    console.log(`Cron: Created lead ${leadgenId}`);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Cron: Error polling leads for integration ${integration.id}:`, err.message);
                }
            }
        } catch (error) {
            console.error("Cron: Failed to run Meta polling job:", error);
        }
    });

    // Gmail Fallback Sync (Run every 15 minutes)
    cron.schedule("*/15 * * * *", async () => {
        console.log("Running Gmail fallback sync...");
        try {
            const { syncGmailLeads } = require("../controllers/gmailController");
            const result = await syncGmailLeads();
            console.log(`Gmail Cron: ${result.message}`);
        } catch (err) {
            console.error("Gmail Cron Error:", err.message);
        }
    });

    // Gmail Watch Renewal (Run daily at midnight)
    cron.schedule("0 0 * * *", async () => {
        console.log("Checking Gmail watch expiries...");
        try {
            const integrations = await prisma.gmailIntegration.findMany({
                where: { isActive: true }
            });
            const { getGmailClient } = require("../controllers/gmailController"); // Note: getGmailClient is not exported, we need to export it or just re-run setupWatch

            for (const integration of integrations) {
                // If expiry is within next 2 days, renew
                const now = new Date();
                const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

                if (!integration.watchExpiry || integration.watchExpiry < twoDaysFromNow) {
                    console.log(`Renewing watch for ${integration.email}...`);
                    // Quick fix: Just run the setupWatch equivalent logic
                    try {
                        const { google } = require('googleapis');
                        const oauth2Client = new google.auth.OAuth2();
                        const token = decrypt(integration.encryptedAccessToken);
                        const refreshToken = decrypt(integration.encryptedRefreshToken);
                        oauth2Client.setCredentials({ access_token: token, refresh_token: refreshToken === "missing" ? undefined : refreshToken });
                        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
                        
                        const topicName = process.env.GMAIL_PUBSUB_TOPIC || 'projects/mock-project/topics/gmail-leads';
                        const response = await gmail.users.watch({
                            userId: 'me',
                            requestBody: { labelIds: ['INBOX'], labelFilterAction: 'include', topicName }
                        });
                        
                        const expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 6);
                        
                        await prisma.gmailIntegration.update({
                            where: { id: integration.id },
                            data: { historyId: response.data.historyId, watchExpiry: expiryDate }
                        });
                        console.log(`Successfully renewed watch for ${integration.email}`);
                    } catch (innerErr) {
                        console.error(`Failed to renew watch for ${integration.email}:`, innerErr.message);
                    }
                }
            }
        } catch (err) {
            console.error("Gmail Watch Renewal Cron Error:", err.message);
        }
    });
};

module.exports = startCronJobs;
