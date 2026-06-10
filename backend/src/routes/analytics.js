const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const leaderboardController = require("../controllers/leaderboardController");
const { getUserCallAnalytics, getAllUsersCallSummary } = require("../controllers/userCallAnalyticsController");

router.use(authMiddleware);

/**
 * @openapi
 * /api/analytics/leaderboard:
 *   get:
 *     summary: Get sales leaderboard
 *     description: Retrieve ranked performance of all employees based on won leads.
 *     tags:
 *       - Analytics
 *     responses:
 *       200:
 *         description: Leaderboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId: { type: string }
 *                   name: { type: string }
 *                   wonLeads: { type: integer }
 *       401:
 *         description: Unauthorized
 */
router.get("/leaderboard", leaderboardController.getLeaderboard);

/**
 * @openapi
 * /api/analytics/team-performance:
 *   get:
 *     summary: Team performance analytics
 *     description: Detailed breakdown of team metrics. Admin only.
 *     tags:
 *       - Analytics
 *     responses:
 *       200:
 *         description: Performance statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalLeads: { type: integer }
 *                 conversionRate: { type: number }
 *                 teamPerformance: { type: array, items: { type: object } }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 */
router.get("/team-performance", checkPermission("dashboard", "view"), analyticsController.getTeamPerformance);

/**
 * @openapi
 * /api/analytics/response-time:
 *   get:
 *     summary: Response time analytics
 *     description: Stats on lead response and conversion times. Admin only.
 *     tags:
 *       - Analytics
 *     responses:
 *       200:
 *         description: Response time statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageResponseTime: { type: string }
 *                 averageWonTime: { type: string }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 */
router.get("/response-time", checkPermission("dashboard", "view"), analyticsController.getResponseTimeAnalytics);

/**
 * @openapi
 * /api/analytics/dashboard:
 *   get:
 *     summary: Comprehensive dashboard analytics
 *     description: Returns lead funnel, revenue trends, and conversion stats. Admin only.
 *     tags:
 *       - Analytics
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/dashboard", checkPermission("dashboard", "view"), analyticsController.getDashboardAnalytics);
router.get("/sales-performance", checkPermission("dashboard", "view"), analyticsController.getSalesPerformance);

// Personal dashboard — every authenticated user can see their own stats
router.get("/my-dashboard", analyticsController.getMyDashboard);

// Team lead dashboard — dept-scoped, TEAM_LEAD only
router.get("/team-dashboard", roleMiddleware(["TEAM_LEAD"]), analyticsController.getTeamLeadDashboard);

// Per-member drill-down report — team lead (own dept), admin, super admin
router.get("/team-dashboard/member/:memberId", roleMiddleware(["TEAM_LEAD", "ADMIN", "SUPER_ADMIN"]), analyticsController.getTeamMemberReport);

// User call analytics — requires admin/manager level
router.get("/user-calls", checkPermission("dashboard", "view"), getAllUsersCallSummary);
router.get("/user-calls/:userId", checkPermission("dashboard", "view"), getUserCallAnalytics);

module.exports = router;
