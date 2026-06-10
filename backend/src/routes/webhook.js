const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");
// Public — VoiceLink posts here, no auth token needed

// Public routes
/**
 * @openapi
 * /api/webhooks/leads:
 *   post:
 *     summary: Inbound lead webhook
 *     description: Receive leads from external platforms (Facebook, Instagram, Google Ads, etc.). Triggers automated scoring and welcome emails.
 *     tags:
 *       - Webhooks
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeadWebhookRequest'
 *     responses:
 *       200:
 *         description: Lead already exists (Duplicate)
 *       201:
 *         description: Lead processed successfully
 *       400:
 *         description: Bad Request - Missing name or phone
 *       500:
 *         description: Server error
 */
router.post("/leads", webhookController.handleLeadWebhook);

/**
 * @openapi
 * /api/webhooks/zenvoice-agent:
 *   post:
 *     summary: ZenVoice AI Agent data webhook
 *     description: Receive data captured by ZenVoice AI agents during calls. Automatically updates lead status, score, and tags based on captured interests.
 *     tags:
 *       - Webhooks
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ZenVoiceWebhookRequest'
 *     responses:
 *       200:
 *         description: Data processed (may or may not have matched a lead)
 *       400:
 *         description: Bad Request - Missing required payload keys
 *       500:
 *         description: Server error
 */
router.post("/zenvoice-agent", webhookController.handleZenVoiceAgentWebhook);

/**
 * @openapi
 * /api/webhooks/calendly:
 *   post:
 *     summary: Calendly booking webhook
 *     description: Receive notifications when a meeting is scheduled via Calendly. Automatically creates leads and high-priority tasks in the CRM.
 *     tags:
 *       - Webhooks
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CalendlyWebhookRequest'
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
router.post("/calendly", webhookController.handleCalendlyWebhook);

// VoiceLink call event — posted by VoiceLink on every call state change (no auth)
router.post("/voicelink-events", webhookController.handleVoiceLinkCallEvent);

// TeleCMI HTTP web flow — called by TeleCMI when client dials the DID number (no auth)
router.post("/telecmi/inbound", webhookController.handleTelecmiInbound);

// TeleCMI CDR — called by TeleCMI when a call ends with duration and status (no auth)
router.post("/telecmi/cdr", webhookController.handleTelecmiCdr);

module.exports = router;
