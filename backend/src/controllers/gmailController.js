const { google } = require('googleapis');
const prisma = require('../utils/prisma');
const { encrypt, decrypt } = require('../utils/crypto');
const { getWorkspaceFilter } = require('../utils/workspaceScope');
const axios = require('axios');

// Using Google OAuth credentials from env or mock if not available
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'mock-client-id',
  process.env.GOOGLE_CLIENT_SECRET || 'mock-client-secret',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/integrations/gmail/oauth/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.labels'];

exports.oauthStart = (req, res) => {
    try {
        // If no real Google Client ID is configured, bypass to the mock test-code
        if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'mock-client-id') {
            return res.json({ url: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/integrations/gmail/oauth/callback?code=test-code` });
        }

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
        res.json({ url });
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate OAuth URL', error: error.message });
    }
};

exports.oauthCallback = async (req, res) => {
    const { code } = req.query;
    try {
        if (code === "test-code") {
            // For testing
            const testEmail = "test@gmail.com";
            await prisma.gmailIntegration.deleteMany({});
            await prisma.gmailIntegration.create({
                data: {
                    email: testEmail,
                    encryptedRefreshToken: encrypt("test-refresh-token"),
                    encryptedAccessToken: encrypt("test-access-token"),
                    isActive: true,
                    labelFilters: ["INBOX"]
                }
            });
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations/gmail`);
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const emailAddress = profile.data.emailAddress;

        const existing = await prisma.gmailIntegration.findFirst();
        
        const data = {
            email: emailAddress,
            encryptedAccessToken: encrypt(tokens.access_token),
            isActive: true
        };
        
        if (tokens.refresh_token) {
            data.encryptedRefreshToken = encrypt(tokens.refresh_token);
        }

        if (existing) {
            await prisma.gmailIntegration.update({ where: { id: existing.id }, data });
        } else {
            // Fallback for refresh token if not provided on update
            if (!data.encryptedRefreshToken) data.encryptedRefreshToken = encrypt("missing");
            await prisma.gmailIntegration.create({ data });
        }

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations/gmail`);
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.status(500).send('Authentication failed.');
    }
};

exports.getStatus = async (req, res) => {
    try {
        const integration = await prisma.gmailIntegration.findFirst({ where: { isActive: true } });
        if (!integration) return res.json({ connected: false });
        res.json({ 
            connected: true, 
            email: integration.email, 
            settings: {
                labelFilters: integration.labelFilters,
                autoAssignUserId: integration.autoAssignUserId
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get status', error: error.message });
    }
};

exports.disconnect = async (req, res) => {
    try {
        await prisma.gmailIntegration.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        });
        res.json({ message: 'Gmail disconnected successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to disconnect', error: error.message });
    }
};

exports.getLeads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Confine Gmail-sourced leads to the requesting user's workspace (multi-tenant isolation).
        const where = { source: 'GMAIL', ...getWorkspaceFilter(req.user) };

        const leads = await prisma.lead.findMany({
            where,
            orderBy: { gmailReceivedAt: 'desc' },
            skip,
            take: limit,
            include: { assignedTo: { select: { id: true, name: true } } }
        });

        const total = await prisma.lead.count({ where });

        res.json({
            data: leads,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Gmail leads', error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { labelFilters, autoAssignUserId } = req.body;
        const integration = await prisma.gmailIntegration.findFirst({ where: { isActive: true } });
        if (!integration) return res.status(404).json({ message: "No active Gmail integration found" });

        await prisma.gmailIntegration.update({
            where: { id: integration.id },
            data: { labelFilters, autoAssignUserId }
        });

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update settings', error: error.message });
    }
};

exports.setupWatch = async (req, res) => {
    try {
        const integration = await prisma.gmailIntegration.findFirst({ where: { isActive: true } });
        if (!integration) return res.status(400).json({ message: "No active Gmail integration found" });

        const topicName = process.env.GMAIL_PUBSUB_TOPIC || 'projects/mock-project/topics/gmail-leads';
        const gmail = await getGmailClient(integration);

        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                labelIds: ['INBOX'], // Watch INBOX by default, could use integration.labelFilters
                labelFilterAction: 'include',
                topicName: topicName
            }
        });

        // Save historyId and watch expiry (7 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 6); // 6 days to be safe

        await prisma.gmailIntegration.update({
            where: { id: integration.id },
            data: {
                historyId: response.data.historyId,
                watchExpiry: expiryDate
            }
        });

        res.json({ message: "Watch setup complete", data: response.data });
    } catch (error) {
        console.error("Watch setup error:", error);
        res.status(500).json({ message: 'Failed to setup watch', error: error.message });
    }
};

exports.webhookReceive = async (req, res) => {
    try {
        if (!req.body || !req.body.message || !req.body.message.data) {
            return res.status(400).send("Bad Request");
        }

        const dataStr = Buffer.from(req.body.message.data, 'base64').toString('utf8');
        const data = JSON.parse(dataStr);
        
        console.log(`Received Gmail webhook for ${data.emailAddress}, historyId: ${data.historyId}`);

        // Acknowledge receipt to Google immediately
        res.status(200).send("OK");

        // Process in background
        setTimeout(async () => {
            try {
                console.log("Triggering syncGmailLeads from webhook...");
                await syncGmailLeads();
            } catch (err) {
                console.error("Webhook processing error:", err);
            }
        }, 100);

    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send("Error");
    }
};

const { extractLeadFromEmail } = require('../services/gmailExtractionService');

async function getGmailClient(integration) {
    const token = decrypt(integration.encryptedAccessToken);
    const refreshToken = decrypt(integration.encryptedRefreshToken);
    
    oauth2Client.setCredentials({
        access_token: token,
        refresh_token: refreshToken === "missing" ? undefined : refreshToken
    });
    
    return google.gmail({ version: 'v1', auth: oauth2Client });
}

function getHeader(headers, name) {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
}

function parseFromHeader(fromStr) {
    const match = fromStr.match(/(.*?)<(.+?)>/);
    if (match) {
        return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() };
    }
    return { name: fromStr.trim(), email: fromStr.trim() };
}

async function syncGmailLeads() {
    let syncedCount = 0;
    try {
        const integration = await prisma.gmailIntegration.findFirst({ where: { isActive: true } });
        if (!integration) return { count: 0, message: "No active Gmail integration found" };

        const gmail = await getGmailClient(integration);
        
        // Build query based on settings
        let q = 'is:unread';
        if (integration.labelFilters && Array.isArray(integration.labelFilters) && integration.labelFilters.length > 0) {
            const labels = integration.labelFilters.filter(l => l !== 'INBOX').map(l => `label:${l}`).join(' OR ');
            if (labels) {
                q += ` (${labels})`;
            }
        }

        const messagesRes = await gmail.users.messages.list({
            userId: 'me',
            q: q,
            maxResults: 20 // Process 20 at a time to prevent timeout
        });

        if (!messagesRes.data.messages || messagesRes.data.messages.length === 0) {
            return { count: 0, message: "Synced 0 new lead(s)" };
        }
        
        for (const msg of messagesRes.data.messages) {
            const msgId = msg.id;
            
            // Check if we already processed this message
            const existing = await prisma.lead.findUnique({ where: { gmailMessageId: msgId } });
            if (existing) continue;

            const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
            const headers = fullMsg.data.payload.headers;
            
            const subject = getHeader(headers, 'Subject') || "No Subject";
            const from = getHeader(headers, 'From');
            const { name: senderName, email: senderEmail } = parseFromHeader(from);
            const internalDate = parseInt(fullMsg.data.internalDate);
            
            // Get email body (simple parsing, ignoring multipart complexity for basic text extraction)
            let bodyData = "";
            if (fullMsg.data.payload.parts) {
                const textPart = fullMsg.data.payload.parts.find(p => p.mimeType === 'text/plain');
                if (textPart && textPart.body && textPart.body.data) {
                    bodyData = Buffer.from(textPart.body.data, 'base64').toString('utf8');
                }
            } else if (fullMsg.data.payload.body && fullMsg.data.payload.body.data) {
                bodyData = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf8');
            }

            // Extract Lead
            const extracted = await extractLeadFromEmail(bodyData, subject, senderEmail, senderName);

            await prisma.lead.create({
                data: {
                    name: extracted.name,
                    email: extracted.email || senderEmail,
                    phone: extracted.phone,
                    company: extracted.company,
                    source: "GMAIL",
                    enquiryType: "PRODUCT",
                    status: "NEW",
                    gmailMessageId: msgId,
                    gmailThreadId: fullMsg.data.threadId,
                    gmailSenderEmail: senderEmail,
                    gmailSenderName: senderName,
                    gmailSubject: subject,
                    gmailReceivedAt: new Date(internalDate),
                    assignedToId: integration.autoAssignUserId || null,
                    notes: {
                        create: [{ content: `[Gmail Lead Auto-Extracted]\nSubject: ${subject}\nRequirements:\n${extracted.requirements}\n\nOriginal Email:\n${bodyData}` }]
                    }
                }
            });
            
            // Mark as read (remove UNREAD label)
            try {
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: msgId,
                    requestBody: { removeLabelIds: ['UNREAD'] }
                });
            } catch (err) {
                console.error("Failed to mark email as read", err.message);
            }

            syncedCount++;
        }
        
        return { count: syncedCount, message: `Synced ${syncedCount} new lead(s)` };
    } catch (error) {
        console.error("syncGmailLeads error:", error);
        throw error;
    }
}

exports.syncGmailLeads = syncGmailLeads;

exports.manualSync = async (req, res) => {
    try {
        const result = await syncGmailLeads();
        res.json(result);
    } catch (error) {
        console.error("Manual sync error:", error);
        res.status(500).json({ message: 'Sync failed', error: error.message });
    }
};
