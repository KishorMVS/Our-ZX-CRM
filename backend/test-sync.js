const axios = require('axios');
const prisma = require('./src/utils/prisma');
const { decrypt } = require('./src/utils/crypto');

const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

async function testFetchLeads() {
    console.log("=== Debugging Meta Ads Sync ===");
    try {
        const integrations = await prisma.metaIntegration.findMany({ where: { isActive: true } });
        if (integrations.length === 0) {
            console.log("❌ No active integration found.");
            return;
        }

        const integration = integrations[0];
        console.log(`✅ Found integration for: ${integration.email}`);
        
        const token = decrypt(integration.encryptedToken);
        if (token === "test-token") {
            console.log("❌ Using test-token. This won't fetch real data.");
            return;
        }

        console.log("\n-> Fetching Pages...");
        let pages = [];
        try {
            const pagesRes = await axios.get(`${META_GRAPH_URL}/me/accounts`, {
                params: { access_token: token }
            });
            pages = pagesRes.data.data;
            console.log(`✅ Found ${pages.length} pages`);
        } catch (pageErr) {
            console.error("❌ Failed to fetch pages:", pageErr.response?.data || pageErr.message);
            return;
        }

        for (const page of pages) {
            console.log(`\n-> Fetching forms for page: ${page.id} (${page.name || 'Unknown'})`);
            try {
                const formsRes = await axios.get(`${META_GRAPH_URL}/${page.id}/leadgen_forms`, {
                    params: { access_token: page.access_token || token }
                });
                
                const forms = formsRes.data.data;
                console.log(`✅ Found ${forms.length} forms on this page`);
                
                for (const form of forms) {
                    console.log(`   -> Fetching leads for form: ${form.id} (${form.name})`);
                    try {
                        const leadsRes = await axios.get(`${META_GRAPH_URL}/${form.id}/leads`, {
                            params: { access_token: token }
                        });
                        const leads = leadsRes.data.data;
                        console.log(`   ✅ Found ${leads.length} leads in this form`);
                        if (leads.length > 0) {
                            console.log(`      Sample lead:`, JSON.stringify(leads[0].field_data));
                        }
                    } catch (err) {
                         console.error(`   ❌ Failed to fetch leads for form ${form.id}:`, err.response?.data?.error?.message || err.message);
                    }
                }
                
            } catch (err) {
                console.error(`❌ Failed to fetch forms for ${page.id}:`, err.response?.data?.error?.message || err.message);
            }
        }

    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

testFetchLeads();
