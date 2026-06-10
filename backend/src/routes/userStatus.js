const express = require("express");
const router = express.Router();
const { updateMyStatus, getAllUsersStatus, getMyTodayLogs, getLastSeen, getTeamStatusSummary } = require("../controllers/userStatusController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/user-status/me:
 *   patch:
 *     summary: Update my status
 *     description: Update current user's online status (ONLINE, OFFLINE, BREAK)
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ONLINE, OFFLINE, BREAK]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 *       401:
 *         description: Unauthorized
 */
router.patch("/me", updateMyStatus);

/**
 * @openapi
 * /api/user-status/all:
 *   get:
 *     summary: Get all users status
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: List of user statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId: { type: string }
 *                   status: { type: string }
 *                   note: { type: string }
 *                   lastSeen: { type: string, format: date-time }
 */
router.get("/all", getAllUsersStatus);

/**
 * @openapi
 * /api/user-status/me/logs-today:
 *   get:
 *     summary: Get my status logs for today
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: My status logs for today
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/me/logs-today", getMyTodayLogs);

/**
 * @openapi
 * /api/user-status/{userId}/last-seen:
 *   get:
 *     summary: Get last seen of a user
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Last seen information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId: { type: string }
 *                 lastSeen: { type: string, format: date-time }
 */
router.get("/:userId/last-seen", getLastSeen);

/**
 * @openapi
 * /api/user-status/team-summary:
 *   get:
 *     summary: Get team status summary (durations)
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Summary of all users status durations
 */
router.get("/team-summary", getTeamStatusSummary);

module.exports = router;
