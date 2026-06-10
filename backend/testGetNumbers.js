require("dotenv").config();
const axios = require("axios");
const { signIn } = require("./src/services/zenvoiceService");

async function main() {
    console.log("Signing in to ZenVoice...");
    const token = await signIn();
    
    console.log("\nFetching registered numbers from https://voice.zenxai.io/api/v1/registered-numbers...");
    const response = await axios.get("https://voice.zenxai.io/api/v1/registered-numbers", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    
    console.log("\nRegistered Numbers Response:", JSON.stringify(response.data, null, 2));
}

main().catch(console.error);
