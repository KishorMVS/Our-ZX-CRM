const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Employee routes
/**
 * @openapi
 * /api/leave/apply:
 *   post:
 *     summary: Apply for leave or WFH
 *     description: Submit a leave request for approval. Restricted to authenticated users.
 *     tags:
 *       - Leave
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyLeaveRequest'
 *     responses:
 *       200:
 *         description: Leave application submitted successfully
 *       400:
 *         description: Bad Request - Missing fields, invalid date range, or insufficient comp-off balance
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/apply", leaveController.applyLeave);

/**
 * @openapi
 * /api/leave/my:
 *   get:
 *     summary: Get my leave history
 *     description: Retrieve all leave applications submitted by the current user.
 *     tags:
 *       - Leave
 *     responses:
 *       200:
 *         description: List of leave applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Leave'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/my", leaveController.getMyLeaves);

/**
 * @openapi
 * /api/leave/stats:
 *   get:
 *     summary: Get my leave statistics
 *     description: Retrieve counts of approved, pending, and rejected leaves for the current year.
 *     tags:
 *       - Leave
 *     responses:
 *       200:
 *         description: Leave statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeaveStats'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/stats", leaveController.getLeaveStats);

// Admin routes
/**
 * @openapi
 * /api/leave/pending:
 *   get:
 *     summary: Get pending leave requests
 *     description: Retrieve all leave applications where the current user is an approver and has not yet responded. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leave
 *     responses:
 *       200:
 *         description: List of pending requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Leave'
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/pending", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.getPendingLeaves);

/**
 * @openapi
 * /api/leave/all:
 *   get:
 *     summary: Get all leave requests (Admin)
 *     description: Retrieve all leave applications across the company. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leave
 *     responses:
 *       200:
 *         description: List of all leave requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Leave'
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/all", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.getAllLeaves);

/**
 * @openapi
 * /api/leave/approve/{id}:
 *   post:
 *     summary: Approve a leave request
 *     description: Approve a specific leave application. Triggers attendance record creation if fully approved. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leave
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The leave ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave approved successfully
 *       403:
 *         description: Forbidden - You are not an approver for this leave
 *       404:
 *         description: Leave not found
 *       500:
 *         description: Server error
 */
router.post("/approve/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.approveLeave);

/**
 * @openapi
 * /api/leave/reject/{id}:
 *   post:
 *     summary: Reject a leave request
 *     description: Reject a specific leave application and provide feedback. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Leave
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The leave ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave rejected successfully
 *       403:
 *         description: Forbidden - You are not an approver for this leave
 *       404:
 *         description: Leave not found
 *       500:
 *         description: Server error
 */
router.post("/reject/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leaveController.rejectLeave);

module.exports = router;
