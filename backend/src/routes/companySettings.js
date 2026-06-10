const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getSettings, updateSettings, testSmtp, getLeadOptions } = require("../controllers/companySettingsController");

router.use(authMiddleware);

/**
 * @openapi
 * /api/company-settings:
 *   get:
 *     summary: Get company settings
 *     description: Retrieve global company settings like name, contact info, and tax details.
 *     tags:
 *       - Company
 *     responses:
 *       200:
 *         description: Successfully retrieved company settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanySettings'
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       500:
 *         description: Server error while fetching settings
 *   patch:
 *     summary: Update company settings
 *     description: Update global company settings. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Company
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanySettings'
 *     responses:
 *       200:
 *         description: Successfully updated company settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanySettings'
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       403:
 *         description: Forbidden - Insufficient permissions (Admin required)
 *       500:
 *         description: Server error while updating settings
 */
router.get("/lead-options", getLeadOptions);
router.get("/", getSettings);
router.patch("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateSettings);
router.put("/",   roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateSettings);
router.post("/test-smtp", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), testSmtp);

module.exports = router;
