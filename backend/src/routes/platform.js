const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/platformController");
const zxcall = require("../controllers/zxcallController");
const platformMiddleware = require("../middleware/platformMiddleware");

// Public — platform owner login
router.post("/auth/login", ctrl.platformLogin);

// Protected — require PLATFORM_OWNER token
router.get("/stats", platformMiddleware, ctrl.getPlatformStats);
router.get("/workspaces", platformMiddleware, ctrl.getWorkspaces);
router.get("/workspaces/:id", platformMiddleware, ctrl.getWorkspaceDetail);
router.patch("/workspaces/:id/toggle-status", platformMiddleware, ctrl.toggleWorkspaceStatus);
router.delete("/workspaces/:id", platformMiddleware, ctrl.deleteWorkspace);

// ZX Call onboarding requests
router.get("/zxcall-requests", platformMiddleware, zxcall.listRequests);
router.patch("/zxcall-requests/:id/activate", platformMiddleware, zxcall.activateRequest);

module.exports = router;
