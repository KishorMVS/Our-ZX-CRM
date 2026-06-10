const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/integrations:
 *   get:
 *     summary: Get all integrations
 *     description: Retrieve a list of all configured integrations with their status and configuration.
 *     tags:
 *       - Integrations
 *     responses:
 *       200:
 *         description: List of integrations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Integration'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   patch:
 *     summary: Toggle integration status
 *     description: Enable or disable an integration. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Integrations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The integration ID
 *     responses:
 *       200:
 *         description: Integration status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Super Admin only
 *       404:
 *         description: Integration not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update integration configuration
 *     description: Update the configuration settings for an integration. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Integrations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The integration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config: {}
 *     responses:
 *       200:
 *         description: Integration configuration updated successfully
 *       400:
 *         description: Bad Request - Invalid configuration
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Super Admin only
 *       404:
 *         description: Integration not found
 *       500:
 *         description: Server error
 */
router.get("/", integrationController.getIntegrations);

// Toggle integration (Admin only)
router.patch("/:id/toggle", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), integrationController.toggleIntegration);

// Update integration config (Admin only)
router.put("/:id/config", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), integrationController.updateIntegrationConfig);

const leadCaptureController = require("../controllers/leadCaptureController");

// Google Sheets specific
router.post("/google-sheets/config", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leadCaptureController.saveGoogleSheetsConfig);
router.delete("/google-sheets/config/:sheetId", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leadCaptureController.removeGoogleSheetConfig);
router.post("/:id/google-sheets/sync", leadCaptureController.syncGoogleSheetsLeads);

module.exports = router;
