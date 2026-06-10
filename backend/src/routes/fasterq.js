const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const {
    getCalls, getAgentCalls, getAnalytics, streamRecording, debugCalls,
    getSettings, saveSettings, deleteSettings, transcribeRecording,
} = require("../controllers/fasterqController");

router.get("/settings",    auth, getSettings);
router.post("/settings",   auth, saveSettings);
router.delete("/settings", auth, deleteSettings);
router.get("/calls",       auth, getCalls);
router.get("/agent-calls", auth, getAgentCalls);
router.get("/analytics",   auth, getAnalytics);
router.get("/recording",   auth, streamRecording);
router.post("/transcribe", auth, transcribeRecording);
router.get("/debug",       auth, debugCalls);

module.exports = router;
