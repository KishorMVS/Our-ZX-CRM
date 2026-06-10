const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Global search
 *     description: Search across all modules (leads, customers, deals, tasks).
 *     tags:
 *       - Search
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads: { type: "array", items: { $ref: "#/components/schemas/Lead" } }
 *                 customers: { type: "array", items: { $ref: "#/components/schemas/Customer" } }
 *                 deals: { type: "array", items: { $ref: "#/components/schemas/Deal" } }
 *                 tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", searchController.globalSearch);

module.exports = router;
