const axios = require('axios');

async function triggerWebhook() {
    console.log("Simulating a Meta Ads Webhook Event...");
    
    // We are simulating what Facebook's servers send to your /webhook endpoint
    const payload = {
        object: "page",
        entry: [
            {
                id: "1234567890",
                time: Math.floor(Date.now() / 1000),
                changes: [
                    {
                        field: "leadgen",
                        value: {
                            ad_id: "ad_123",
                            form_id: "form_456",
                            leadgen_id: "test_lead_" + Date.now(), // Unique ID so it doesn't get deduplicated immediately
                            created_time: Math.floor(Date.now() / 1000),
                            page_id: "page_789",
                            adgroup_id: "adset_012",
                            // In real webhooks, Facebook doesn't send the names or emails in the webhook body. 
                            // They only send the ID, and the backend has to fetch the details using the access token.
                            // To make this test script work WITHOUT a real Meta Token, 
                            // our controller would usually fail to fetch the real lead. 
                            // So let's mock the controller behavior for testing if it hits an error.
                        }
                    }
                ]
            }
        ]
    };

    try {
        const response = await axios.post('http://localhost:5001/api/integrations/meta/webhook', payload);
        console.log("Webhook triggered successfully! Status:", response.status);
        console.log("Note: If you don't have a REAL Meta access token, the backend might log an error saying 'Failed to process leadgen_id' because it attempts to reach graph.facebook.com to get the lead's email/name. However, the event was successfully received!");
    } catch (error) {
        console.error("Failed to trigger webhook:", error.message);
    }
}

triggerWebhook();
