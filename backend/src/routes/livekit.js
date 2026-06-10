const express = require("express");
const router = express.Router();
const livekitController = require("../controllers/livekitController");
const authMiddleware = require("../middleware/authMiddleware");

// Token generation for rooms
router.post("/token", authMiddleware, livekitController.getToken);

// Webhook handling from LiveKit Server
router.post("/webhook", express.raw({ type: "application/webhook+json" }), livekitController.handleWebhook);

// Recordings list & management
router.get("/recordings", authMiddleware, livekitController.getRecordings);
router.delete("/recordings/:id", authMiddleware, livekitController.deleteRecording);
router.post("/recording/start", authMiddleware, livekitController.startRecording);
router.post("/recording/stop", authMiddleware, livekitController.stopRecording);

module.exports = router;
