const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");
const leadController = require("../controllers/leadController"); // Reuse existing lead export
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/export/leads:
 *   get:
 *     summary: Export leads to CSV
 *     description: Download all leads as a CSV file.
 *     tags:
 *       - Export
 *     responses:
 *       200:
 *         description: CSV file downloaded successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/leads", leadController.exportLeads);

/**
 * @openapi
 * /api/export/tasks:
 *   get:
 *     summary: Export tasks to CSV
 *     description: Download all tasks as a CSV file.
 *     tags:
 *       - Export
 *     responses:
 *       200:
 *         description: CSV file downloaded successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/tasks", exportController.exportTasks);

/**
 * @openapi
 * /api/export/team-performance:
 *   get:
 *     summary: Export team performance to CSV
 *     description: Download team performance metrics as a CSV file.
 *     tags:
 *       - Export
 *     responses:
 *       200:
 *         description: CSV file downloaded successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/team-performance", exportController.exportTeamPerformance);
router.get("/sales-performance", exportController.exportSalesPerformance);

module.exports = router;
