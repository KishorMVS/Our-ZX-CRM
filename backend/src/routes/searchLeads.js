const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { searchBusinessLeads, importSearchedLeads } = require("../controllers/searchLeadsController");

router.use(authMiddleware);

// Search businesses via Serper API
/**
 * @openapi
 * /api/search-leads:
 *   post:
 *     summary: Search businesses via Serper API
 *     description: Perform a business search to find potential leads, including contact info and ratings.
 *     tags:
 *       - Search Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessSearchRequest'
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads: { type: "array", items: { $ref: "#/components/schemas/BusinessSearchResult" } }
 *                 total: { type: "integer" }
 *                 query: { type: "string" }
 *       400:
 *         description: Bad Request - Missing query
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", searchBusinessLeads);

// Import selected search results as leads (Admin/Super Admin only)
/**
 * @openapi
 * /api/search-leads/import:
 *   post:
 *     summary: Import searched leads
 *     description: Save selected search results as official leads in the CRM. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Search Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImportSearchedLeadsRequest'
 *     responses:
 *       200:
 *         description: Leads imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 created: { type: "integer" }
 *                 duplicates: { type: "integer" }
 *                 leads: { type: "array", items: { $ref: "#/components/schemas/Lead" } }
 *       400:
 *         description: Bad Request - No leads provided
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post("/import", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), importSearchedLeads);

module.exports = router;
