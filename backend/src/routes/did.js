const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const didController = require("../controllers/didController");

router.use(authMiddleware);

// ── Super Admin routes ────────────────────────────────────────────────────────
router.post("/sync",                roleMiddleware(["SUPER_ADMIN"]), didController.syncDIDs);
router.get("/pool",                 roleMiddleware(["SUPER_ADMIN"]), didController.getDIDPool);
router.post("/allocate-to-admin",   roleMiddleware(["SUPER_ADMIN"]), didController.allocateToAdmin);
router.delete("/:didId/deallocate-admin", roleMiddleware(["SUPER_ADMIN"]), didController.deallocateAdmin);
router.get("/admins-summary",       roleMiddleware(["SUPER_ADMIN"]), didController.getAdminsSummary);
router.get("/workspace-admins",     roleMiddleware(["SUPER_ADMIN"]), didController.getWorkspaceAdmins);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get("/my-pool",              roleMiddleware(["ADMIN"]), didController.getMyAdminPool);
router.post("/assign-to-employee",  roleMiddleware(["ADMIN"]), didController.assignToEmployee);
router.delete("/:didId/unassign-employee", roleMiddleware(["ADMIN"]), didController.unassignEmployee);
router.get("/assignable-employees", roleMiddleware(["ADMIN"]), didController.getAssignableEmployees);

// ── Employee / any authenticated user ────────────────────────────────────────
router.get("/my-did", didController.getMyDID);

module.exports = router;
