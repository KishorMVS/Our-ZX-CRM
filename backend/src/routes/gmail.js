const express = require("express");
const router = express.Router();
const gmailController = require("../controllers/gmailController");
const authMiddleware = require("../middleware/authMiddleware"); // Assuming standard auth middleware

// OAuth flows (public callback, but start requires auth if connecting from UI)
router.get("/oauth/start", authMiddleware, gmailController.oauthStart);
router.get("/oauth/callback", gmailController.oauthCallback); // No auth, Google redirects here

// App actions (requires auth)
router.delete("/disconnect", authMiddleware, gmailController.disconnect);
router.get("/leads", authMiddleware, gmailController.getLeads);
router.post("/watch", authMiddleware, gmailController.setupWatch);
router.post("/sync", authMiddleware, gmailController.manualSync);
router.patch("/settings", authMiddleware, gmailController.updateSettings);
router.get("/status", authMiddleware, gmailController.getStatus);

// Webhook (Public, called by Google Pub/Sub)
router.post("/webhook", gmailController.webhookReceive);

module.exports = router;
