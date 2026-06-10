const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { searchLinkedInLeads, importLinkedInLeads } = require("../controllers/linkedinLeadsController");

router.use(authMiddleware);

/**
 * @openapi
 * /api/linkedin-leads:
 *   post:
 *     summary: Search LinkedIn profiles/companies
 *     description: Search LinkedIn profiles or company pages via Serper.
 *     tags:
 *       - Search
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.post("/", searchLinkedInLeads);

/**
 * @openapi
 * /api/linkedin-leads/import:
 *   post:
 *     summary: Import LinkedIn leads
 *     description: Import selected LinkedIn leads into the CRM. Admin/Super Admin only.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leads:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Leads imported successfully
 */
router.post("/import", importLinkedInLeads);

module.exports = router;
