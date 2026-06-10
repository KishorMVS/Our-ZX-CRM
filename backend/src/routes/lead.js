const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const bulkController = require("../controllers/bulkController");

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All routes require authentication
router.use(authMiddleware);

// Bulk Actions
/**
 * @openapi
 * /api/leads/bulk-update:
 *   patch:
 *     summary: Bulk update lead statuses
 *     description: Update the status of multiple leads at once. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkUpdateLeadsRequest'
 *     responses:
 *       200:
 *         description: Leads updated successfully
 *       400:
 *         description: Bad Request - Missing lead IDs or status
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.patch("/bulk-update", checkPermission("leads", "edit"), bulkController.bulkUpdateLeads);

/**
 * @openapi
 * /api/leads/bulk-assign:
 *   patch:
 *     summary: Bulk assign leads to a user
 *     description: Assign multiple leads to a specific user at once. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkAssignLeadsRequest'
 *     responses:
 *       200:
 *         description: Leads assigned successfully
 *       400:
 *         description: Bad Request - Missing lead IDs or assignee ID
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Target user not found
 *       500:
 *         description: Server error
 */
router.patch("/bulk-assign", checkPermission("leads", "edit"), bulkController.bulkAssignLeads);
router.patch("/bulk-distribute", checkPermission("leads", "edit"), bulkController.bulkDistributeLeads);
router.patch("/bulk-distribute-dept", checkPermission("leads", "edit"), bulkController.bulkDistributeByDepartment);
router.patch("/bulk-auto-route", checkPermission("leads", "edit"), bulkController.bulkAutoRouteLeads);

// Export Leads
/**
 * @openapi
 * /api/leads/export:
 *   get:
 *     summary: Export leads to CSV
 *     description: Download all leads as a CSV file.
 *     tags:
 *       - Leads
 *     responses:
 *       200:
 *         description: CSV file download
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/export", checkPermission("leads", "view"), leadController.exportLeads);

// Import Leads from CSV (Admin only)
/**
 * @openapi
 * /api/leads/import:
 *   post:
 *     summary: Import leads from CSV
 *     description: Upload a CSV file to import multiple leads. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csv:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import complete with summary
 *       400:
 *         description: Bad Request - No file uploaded or empty CSV
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post("/import", checkPermission("leads", "create"), csvUpload.single("csv"), leadController.importLeads);

// Check Duplicates
/**
 * @openapi
 * /api/leads/check-duplicate:
 *   post:
 *     summary: Check for duplicate leads
 *     description: Check if a lead already exists by email or phone.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckDuplicateRequest'
 *     responses:
 *       200:
 *         description: Duplicate check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 duplicate: { type: "boolean" }
 *                 existingLeads: { type: "array", items: { $ref: "#/components/schemas/Lead" } }
 *       500:
 *         description: Server error
 */
router.post("/check-duplicate", checkPermission("leads", "view"), leadController.checkDuplicate);

// Merge Leads (Admin only)
/**
 * @openapi
 * /api/leads/merge:
 *   post:
 *     summary: Merge two leads
 *     description: Merge notes, tasks, and activities from a secondary lead into a primary lead. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MergeLeadsRequest'
 *     responses:
 *       200:
 *         description: Leads merged successfully
 *       400:
 *         description: Bad Request - Missing lead IDs
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post("/merge", checkPermission("leads", "edit"), leadController.mergeLeads);

// Get Lead Activities
/**
 * @openapi
 * /api/leads/{id}/activities:
 *   get:
 *     summary: Get lead activities
 *     description: Retrieve the activity log for a specific lead.
 *     tags:
 *       - Leads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The lead ID
 *     responses:
 *       200:
 *         description: Activity list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LeadActivity'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id/activities", checkPermission("leads", "view"), leadController.getLeadActivities);

// Get all leads
/**
 * @openapi
 * /api/leads:
 *   get:
 *     summary: Get all leads
 *     description: Retrieve all leads. Employees only see leads assigned to them. Admins see all leads.
 *     tags:
 *       - Leads
 *     responses:
 *       200:
 *         description: List of leads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Lead'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", checkPermission("leads", "view"), leadController.getLeads);

// Create Lead (Super Admin & Admin Only)
/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Create a new lead
 *     description: Manually add a lead to the system. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLeadRequest'
 *     responses:
 *       201:
 *         description: Lead created
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post("/", checkPermission("leads", "create"), leadController.createLead);

// Assign Lead (Super Admin & Admin Only)
/**
 * @openapi
 * /api/leads/{id}/assign:
 *   patch:
 *     summary: Assign lead to a user
 *     description: Change the owner of a specific lead. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedToId]
 *             properties:
 *               assignedToId: { type: "string" }
 *     responses:
 *       200:
 *         description: Lead assigned successfully
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Lead or User not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/assign", checkPermission("leads", "edit"), leadController.assignLead);

// Update Lead Status (e.g. Employee can update status)
/**
 * @openapi
 * /api/leads/{id}/status:
 *   patch:
 *     summary: Update lead status
 *     description: Update lead status and details. Triggers lead scoring and activity logging.
 *     tags:
 *       - Leads
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The lead ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Lead'
 *     responses:
 *       200:
 *         description: Lead updated
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/status", checkPermission("leads", "edit"), leadController.updateLead);
router.post("/:id/trigger-call", checkPermission("leads", "edit"), leadController.triggerAutoCall);

module.exports = router;
