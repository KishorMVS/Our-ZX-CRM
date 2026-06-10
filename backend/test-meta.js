const axios = require('axios');

async function test() {
    try {
        // Step 1: Login
        console.log("=== Step 1: Login ===");
        const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@zenxai.io',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log("Login OK. Got JWT token.");

        const headers = { Authorization: `Bearer ${token}` };

        // Step 2: Test status endpoint
        console.log("\n=== Step 2: GET /api/integrations/meta/status ===");
        const statusRes = await axios.get('http://localhost:5001/api/integrations/meta/status', { headers });
        console.log("Status response:", JSON.stringify(statusRes.data));

        // Step 3: Test connect endpoint
        console.log("\n=== Step 3: POST /api/integrations/meta/connect ===");
        const connectRes = await axios.post('http://localhost:5001/api/integrations/meta/connect', {
            email: 'test@meta.com',
            token: 'test-token'
        }, { headers });
        console.log("Connect response:", JSON.stringify(connectRes.data));

        // Step 4: Check status again
        console.log("\n=== Step 4: GET /api/integrations/meta/status (after connect) ===");
        const statusRes2 = await axios.get('http://localhost:5001/api/integrations/meta/status', { headers });
        console.log("Status response:", JSON.stringify(statusRes2.data));

        console.log("\n ALL TESTS PASSED!");

    } catch (err) {
        if (err.response) {
            console.error("ERROR", err.response.status, JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("NETWORK ERROR:", err.message);
        }
    }
}

test();
