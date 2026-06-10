const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/departments:
 *   get:
 *     summary: Get all departments
 *     description: Retrieve a list of all company departments with user counts.
 *     tags:
 *       - Departments
 *     responses:
 *       200:
 *         description: List of departments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Department'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a department
 *     description: Add a new department to the system. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Departments
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDepartmentRequest'
 *     responses:
 *       201:
 *         description: Department created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Department'
 *       400:
 *         description: Bad Request - Missing name or duplicate entry
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Super Admin only
 *       500:
 *         description: Server error
 */
router.get("/", departmentController.getDepartments);

/**
 * @openapi
 * /api/departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     description: Retrieve department details including a list of assigned users.
 *     tags:
 *       - Departments
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The department ID
 *     responses:
 *       200:
 *         description: Department details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Department'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a department
 *     description: Remove a department from the system. Cannot be deleted if users are assigned. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Departments
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The department ID
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *       400:
 *         description: Cannot delete department with assigned users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Super Admin only
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.get("/:id", departmentController.getDepartmentById);

// Create, Update & Delete (Admin/Super Admin only)
router.post("/",    roleMiddleware(["SUPER_ADMIN", "ADMIN"]), departmentController.createDepartment);
router.patch("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), departmentController.updateDepartment);
router.delete("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), departmentController.deleteDepartment);

module.exports = router;
