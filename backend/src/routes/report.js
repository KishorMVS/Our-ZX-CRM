const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware(["SUPER_ADMIN", "ADMIN"])); // Reports are for admins

/**
 * @openapi
 * /api/reports/leads-by-source:
 *   get:
 *     summary: Get leads by source
 *     description: Retrieve the count of leads grouped by their source.
 *     tags:
 *       - Reports
 *     responses:
 *       200:
 *         description: List of leads by source
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   source: { type: "string" }
 *                   count: { type: "integer" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/leads-by-source", reportController.getLeadsBySource);

/**
 * @openapi
 * /api/reports/leads-by-employee:
 *   get:
 *     summary: Get leads by employee
 *     description: Retrieve the count of leads assigned to each employee.
 *     tags:
 *       - Reports
 *     responses:
 *       200:
 *         description: List of leads by employee
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   employee: { type: "string" }
 *                   count: { type: "integer" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/leads-by-employee", reportController.getLeadsByEmployee);

/**
 * @openapi
 * /api/reports/conversion-rate:
 *   get:
 *     summary: Get conversion rate
 *     description: Calculate the lead conversion rate (Won vs Total).
 *     tags:
 *       - Reports
 *     responses:
 *       200:
 *         description: Conversion rate statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalLeads: { type: "integer" }
 *                 wonLeads: { type: "integer" }
 *                 conversionRate: { type: "number" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/conversion-rate", reportController.getConversionRate);

/**
 * @openapi
 * /api/reports/monthly-growth:
 *   get:
 *     summary: Get monthly growth
 *     description: Retrieve monthly lead growth statistics for the current year.
 *     tags:
 *       - Reports
 *     responses:
 *       200:
 *         description: Monthly growth data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   month: { type: "string" }
 *                   count: { type: "integer" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/monthly-growth", reportController.getMonthlyGrowth);
 
/**
 * @openapi
 * /api/reports/team-lead-assignments:
 *   get:
 *     summary: Get team lead assignments
 *     description: Retrieve a report of leads assigned to users with the TEAM_LEAD role.
 *     tags:
 *       - Reports
 *     responses:
 *       200:
 *         description: List of team lead assignments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: "string" }
 *                   name: { type: "string" }
 *                   email: { type: "string" }
 *                   primaryCount: { type: "integer" }
 *                   collaboratorCount: { type: "integer" }
 *                   totalCount: { type: "integer" }
 *                   leads:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id: { type: "string" }
 *                         name: { type: "string" }
 *                         status: { type: "string" }
 *                         assignmentType: { type: "string" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/team-lead-assignments", reportController.getTeamLeadAssignments);

module.exports = router;
