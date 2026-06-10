const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function extractLeadFromEmail(emailBody, emailSubject, senderEmail, senderName) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return extractFallback(emailBody, emailSubject, senderEmail, senderName);
        }

        console.log("Extracting lead from email via AI...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using gpt-4o-mini as an accessible fast model
            messages: [
                {
                    role: "system",
                    content: `You are an expert AI assistant that parses email inquiries and extracts lead data.
Extract Name, Phone, Company, and Requirements from the email content.
If any field is missing, return null for that field. 
Return ONLY valid JSON in this format:
{
  "name": "string or null",
  "phone": "string or null",
  "company": "string or null",
  "requirements": "string or null"
}`
                },
                {
                    role: "user",
                    content: `Subject: ${emailSubject}\nFrom: ${senderName} <${senderEmail}>\n\nBody:\n${emailBody}`
                }
            ],
            max_tokens: 500,
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const raw = response.choices[0]?.message?.content?.trim() || "{}";
        const parsed = JSON.parse(raw);

        return {
            name: parsed.name || senderName || "Unknown",
            phone: parsed.phone || extractPhoneRegex(emailBody),
            company: parsed.company || extractCompanyFromEmailDomain(senderEmail),
            requirements: parsed.requirements || "No specific requirements extracted.",
            isAiExtracted: true
        };

    } catch (error) {
        console.error("AI Extraction failed, falling back to regex:", error.message);
        return extractFallback(emailBody, emailSubject, senderEmail, senderName);
    }
}

function extractFallback(emailBody, emailSubject, senderEmail, senderName) {
    return {
        name: senderName || "Unknown",
        phone: extractPhoneRegex(emailBody),
        company: extractCompanyFromEmailDomain(senderEmail),
        requirements: "Requires review. Extracted via basic parser.",
        isAiExtracted: false
    };
}

function extractPhoneRegex(text) {
    if (!text) return null;
    const phoneRegex = /(?:\+?\d{1,3}[-\s]?)?(?:\(?\d{2,4}\)?[-\s]?)?\d{3,4}[-\s]?\d{3,4}/g;
    const matches = text.match(phoneRegex);
    if (matches) {
        // Find first match that looks like a valid length
        const validMatch = matches.find(m => m.replace(/\D/g, '').length >= 10);
        return validMatch ? validMatch.trim() : null;
    }
    return null;
}

function extractCompanyFromEmailDomain(email) {
    if (!email) return null;
    const domain = email.split('@')[1];
    if (!domain) return null;
    const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    if (commonProviders.includes(domain.toLowerCase())) return null; // Not a company domain
    
    // Convert 'example-company.com' to 'Example Company'
    const company = domain.split('.')[0].replace(/-/g, ' ');
    return company.charAt(0).toUpperCase() + company.slice(1);
}

module.exports = { extractLeadFromEmail };
