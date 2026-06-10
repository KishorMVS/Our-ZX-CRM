require("dotenv").config();
const axios = require("axios");
const { signIn } = require("./src/services/zenvoiceService");

async function testCall(assistantId, assistantLabel, fromPhone, toPhone, token) {
    console.log(`\n---------------------------------------------`);
    console.log(`🧪 Testing Outbound Call with:`);
    console.log(`   Assistant: ${assistantLabel} (${assistantId})`);
    console.log(`   From Phone: ${fromPhone} (Twilio US)`);
    console.log(`   To Phone: ${toPhone}`);
    
    const payload = {
        phoneNumber: toPhone,
        fromPhoneNumber: fromPhone,
        selectedAssistant: assistantId,
        metadata: {
            name: "Twilio Gateway Test",
            crmLeadId: "test-id-twilio"
        }
    };

    try {
        const response = await axios.post("https://voice.zenxai.io/api/v1/phone/make_call", payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        console.log(`🎉 SUCCESS! Response:`, JSON.stringify(response.data, null, 2));
        return true;
    } catch (err) {
        console.error(`❌ FAILED: Status ${err.response?.status || 'network'}`);
        console.error(`   Error Message:`, err.response?.data?.message || err.response?.data || err.message);
        return false;
    }
}

async function main() {
    console.log("Signing in to ZenVoice...");
    const token = await signIn();
    
    const targetPhone = "+917695824978"; // User's personal phone
    
    // Using Twilio US number: +17752427674
    await testCall(
        "e2fbe36e-674c-4a1e-89e3-b6e597587186", 
        "service", 
        "+17752427674", 
        targetPhone, 
        token
    );
}

main().catch(console.error);
