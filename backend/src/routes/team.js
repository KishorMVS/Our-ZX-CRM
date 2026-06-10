const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// Routes require authentication
router.use(authMiddleware);

// Team API
/**
 * @openapi
 * /api/team:
 *   get:
 *     summary: Get all team members
 *     description: Retrieve a list of all users in the company. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Team
 *     responses:
 *       200:
 *         description: List of team members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new team member
 *     description: Register a new user and assign a role/department. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Team
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 user: { $ref: "#/components/schemas/User" }
 *       400:
 *         description: Bad Request - User already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/", checkPermission("team", "view"), teamController.getTeam);
router.post("/", checkPermission("team", "create"), teamController.createUser);

/**
 * @openapi
 * /api/team/{id}/toggle:
 *   patch:
 *     summary: Toggle user activation status
 *     description: Activate or deactivate a user's access to the CRM.
 *     tags:
 *       - Team
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User status toggled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch("/:id/toggle", checkPermission("team", "edit"), teamController.toggleUserAccess);

/**
 * @openapi
 * /api/team/{id}:
 *   patch:
 *     summary: Update team member details
 *     description: Modify a user's name, phone, role, or department.
 *     tags:
 *       - Team
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: "string" }
 *               phone: { type: "string" }
 *               role: { type: "string", enum: ["ADMIN", "EMPLOYEE", "AGENT"] }
 *               department: { type: "string" }
 *               jobTitle: { type: "string" }
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch("/:id/c2c", checkPermission("team", "edit"), teamController.toggleC2C);
router.patch("/:id", checkPermission("team", "edit"), teamController.updateUser);

/**
 * @openapi
 * /api/team/{id}:
 *   delete:
 *     summary: Permanently delete a team member
 *     description: Remove a user from the database. Unassigns them from leads and tasks.
 *     tags:
 *       - Team
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.delete("/:id", checkPermission("team", "delete"), teamController.deleteUser);

module.exports = router;
