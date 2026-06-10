const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const ctrl    = require("../controllers/leadCaptureController");

// Auth-protected — workspace configuration
router.get("/config",       auth, ctrl.getConfig);
router.post("/meta-config", auth, ctrl.saveMetaConfig);
router.post("/toggle",      auth, ctrl.toggleIntegration);
router.post("/rotate",      auth, ctrl.rotateToken);

// Public capture endpoints — workspace resolved via captureToken in URL
router.post("/leads/:token",         ctrl.handleUniversal);
router.post("/google-ads/:token",    ctrl.handleGoogleAds);
router.post("/google-sheets/:token", ctrl.handleGoogleSheets);
router.post("/form/:token",          ctrl.handleWebForm);
router.get( "/meta/:token",          ctrl.handleMetaVerify);
router.post("/meta/:token",          ctrl.handleMetaWebhook);

module.exports = router;
