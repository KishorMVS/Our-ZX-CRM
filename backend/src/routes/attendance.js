const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Employee routes
/**
 * @openapi
 * /api/attendance/check-in:
 *   post:
 *     summary: Clock in
 *     description: Record attendance check-in for the current user.
 *     tags:
 *       - Attendance
 *     responses:
 *       200:
 *         description: Checked in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 attendance: { type: object }
 *       401:
 *         description: Unauthorized
 */
router.post("/check-in", attendanceController.checkIn);

/**
 * @openapi
 * /api/attendance/check-out:
 *   post:
 *     summary: Clock out
 *     description: Record attendance check-out for the current user.
 *     tags:
 *       - Attendance
 *     responses:
 *       200:
 *         description: Checked out successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/check-out", attendanceController.checkOut);

/**
 * @openapi
 * /api/attendance/my:
 *   get:
 *     summary: My attendance logs
 *     tags:
 *       - Attendance
 *     responses:
 *       200:
 *         description: Attendance logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   checkIn: { type: string, format: date-time }
 *                   checkOut: { type: string, format: date-time }
 *                   status: { type: string }
 *       401:
 *         description: Unauthorized
 */
router.get("/my", attendanceController.getMyAttendance);

/**
 * @openapi
 * /api/attendance/stats:
 *   get:
 *     summary: My attendance statistics
 *     tags:
 *       - Attendance
 *     responses:
 *       200:
 *         description: Attendance stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDays: { type: integer }
 *                 presentDays: { type: integer }
 *                 lateDays: { type: integer }
 */
router.get("/stats", attendanceController.getAttendanceStats);

// Admin routes
/**
 * @openapi
 * /api/attendance/all:
 *   get:
 *     summary: Get all attendance records
 *     description: Retrieve attendance logs for all employees. Admin only.
 *     tags:
 *       - Attendance
 *     responses:
 *       200:
 *         description: All attendance records
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 */
router.get("/all", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), attendanceController.getAllAttendance);

/**
 * @openapi
 * /api/attendance/admin/monthly-report:
 *   get:
 *     summary: Generate monthly attendance report
 *     tags:
 *       - Attendance
 *     responses:
 *       200:
 *         description: Monthly report data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/admin/monthly-report", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), attendanceController.getAdminMonthlyReport);

/**
 * @openapi
 * /api/attendance/admin/employee/{employeeId}:
 *   get:
 *     summary: Get employee monthly attendance
 *     tags:
 *       - Attendance
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee attendance data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/admin/employee/:employeeId", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), attendanceController.getEmployeeMonthlyAttendance);

/**
 * @openapi
 * /api/attendance/admin/update-status:
 *   post:
 *     summary: Update attendance status
 *     tags:
 *       - Attendance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attendanceId: { type: string }
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Status updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post("/admin/update-status", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), attendanceController.updateAttendanceStatus);
router.post("/admin/award-comp-off", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), attendanceController.awardCompOff);

module.exports = router;
