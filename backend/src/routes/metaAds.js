const express = require("express");
const router = express.Router();
const metaAdsController = require("../controllers/metaAdsController");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * @openapi
 * tags:
 *   name: Meta Ads Integration
 *   description: Meta Ads integration management
 */

// Webhook endpoints (No auth middleware required for webhooks)
router.get("/webhook", metaAdsController.webhookVerify);
router.post("/webhook", express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), metaAdsController.webhookReceive); // Might need raw body for X-Hub-Signature-256 validation if added

// Apply auth middleware for all API routes below
router.use(authMiddleware);

router.post("/connect", metaAdsController.connect);
router.delete("/disconnect", metaAdsController.disconnect);
router.get("/status", metaAdsController.getStatus);
router.get("/accounts", metaAdsController.getAccounts);
router.get("/campaigns", metaAdsController.getCampaigns);
router.get("/adsets", metaAdsController.getAdSets);
router.get("/ads", metaAdsController.getAds);
router.get("/fetch-leads", metaAdsController.fetchLeads);

module.exports = router;
