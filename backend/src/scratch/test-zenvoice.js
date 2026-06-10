const axios = require("axios");

const email = "praveen@hexitetechnologies.com";
const password = "Password@2025";
const encoded = Buffer.from(`${email}:${password}`).toString("base64");

const testBasicAuth = async () => {
    try {
        console.log("Testing basic auth on /assistants...");
        const res = await axios.get("https://voice.zenxai.io/api/v1/assistants", {
            headers: {
                Authorization: `Basic ${encoded}`,
                "Content-Type": "application/json"
            }
        });
        console.log("Success with Basic Auth! Assistants:", res.data);
        return true;
    } catch (err) {
        console.error("Basic Auth failed on /assistants:", err?.response?.data || err.message);
        return false;
    }
};

const testLogin = async () => {
    try {
        console.log("\nTesting login /api/v1/auth/login...");
        const res = await axios.post("https://voice.zenxai.io/api/v1/auth/login", {
            email,
            password
        });
        console.log("Success with Login! Token:", res.data?.data?.token || res.data?.token || res.data);
        return true;
    } catch (err) {
        console.error("Login failed:", err?.response?.data || err.message);
        return false;
    }
};

const testSignin = async () => {
    try {
        console.log("\nTesting signin /api/v1/auth/signin...");
        const res = await axios.post("https://voice.zenxai.io/api/v1/auth/signin", {
            email,
            password
        });
        console.log("Success with Signin! Token:", res.data?.data?.token || res.data?.token || res.data);
        return true;
    } catch (err) {
        console.error("Signin failed:", err?.response?.data || err.message);
        return false;
    }
};

(async () => {
    await testBasicAuth();
    await testLogin();
    await testSignin();
})();
