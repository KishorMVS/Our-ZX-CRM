const axios = require('axios');

async function triggerSync() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@zenxai.io',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log("Login OK.");

        const headers = { Authorization: `Bearer ${token}` };

        console.log("Calling fetch-leads API...");
        const res = await axios.get('http://localhost:5001/api/integrations/meta/fetch-leads', { headers });
        console.log("Success! Response:", res.data);
    } catch (err) {
        console.error("Error calling fetch-leads:", err.response?.data || err.message);
    }
}

triggerSync();
