const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Get current user's permissions
router.get("/me", permissionController.getMyPermissions);

// Admin-only routes
router.get("/role/:role", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.getPermissionsByRole);
router.post("/role/:role", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.updateRolePermissions);

router.get("/roles", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.getRoles);
router.post("/roles", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.createRole);

// User-specific routes
router.get("/user/:userId", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.getUserPermissions);
router.post("/user/:userId", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.updateUserPermissions);

router.post("/seed", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), permissionController.seedDefaultPermissions);

module.exports = router;
