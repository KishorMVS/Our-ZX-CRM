const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/sessions:
 *   get:
 *     summary: Get active sessions
 *     description: Retrieve all active user sessions.
 *     tags:
 *       - Sessions
 *     responses:
 *       200:
 *         description: List of active sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: "string" }
 *                   userId: { type: "string" }
 *                   userAgent: { type: "string" }
 *                   ipAddress: { type: "string" }
 *                   createdAt: { type: "string", format: "date-time" }
 *                   expiresAt: { type: "string", format: "date-time" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/", roleMiddleware(["SUPER_ADMIN"]), sessionController.getActiveSessions);

/**
 * @openapi
 * /api/sessions/logout-all:
 *   post:
 *     summary: Logout all sessions
 *     description: Force logout all users from all devices.
 *     tags:
 *       - Sessions
 *     responses:
 *       200:
 *         description: All sessions terminated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 count: { type: "integer" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post("/logout-all", roleMiddleware(["SUPER_ADMIN"]), sessionController.logoutAllSessions);

module.exports = router;
