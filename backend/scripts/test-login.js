const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('http://localhost:5001/api/platform/auth/login', {
            email: 'owner@zenxai.io',
            password: 'Platform@123'
        });
        console.log("Success:", res.data);
    } catch (err) {
        console.error("Error status:", err.response?.status);
        console.error("Error data:", err.response?.data);
    }
}

test();
