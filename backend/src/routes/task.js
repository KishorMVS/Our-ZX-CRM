const express = require("express");
const router = express.Router();
const tc = require("../controllers/taskController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

const adminOnly = roleMiddleware(["SUPER_ADMIN", "ADMIN"]);

// ── Task CRUD ─────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/tasks:
 *   get:
 *     summary: Get all tasks
 *     description: Retrieve a list of tasks. Employees and Agents only see tasks assigned to them.
 *     tags:
 *       - Tasks
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/tasks", tc.getTasks);

/**
 * @openapi
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     description: Retrieve detailed information about a specific task, including comments and files.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
router.get("/tasks/:id", tc.getTaskById);

/**
 * @openapi
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     description: Create a task and assign it to a user. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Tasks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTaskRequest'
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 task: { $ref: "#/components/schemas/Task" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Lead or Assigned User not found
 *       500:
 *         description: Server error
 */
router.post("/tasks", adminOnly, tc.createTask);

/**
 * @openapi
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task
 *     description: Modify task details. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTaskRequest'
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
router.put("/tasks/:id", adminOnly, tc.updateTask);

/**
 * @openapi
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     description: Remove a task from the system. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
router.delete("/tasks/:id", adminOnly, tc.deleteTask);

// ── Status updates ────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Update task completion status
 *     description: Mark a task as PENDING or COMPLETED.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["PENDING", "COMPLETED"]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/tasks/:id/status", tc.updateTaskStatus);

/**
 * @openapi
 * /api/tasks/{id}/kanban:
 *   patch:
 *     summary: Update kanban status
 *     description: Move a task between kanban columns (BACKLOG, TODO, IN_PROGRESS, etc.).
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kanbanStatus:
 *                 type: string
 *                 enum: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"]
 *               orderIndex:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Kanban status updated
 *       400:
 *         description: Invalid kanban status
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/tasks/:id/kanban", tc.updateKanbanStatus);   // drag-and-drop

// ── Comments (all authenticated users) ────────────────────────────────────────
/**
 * @openapi
 * /api/tasks/{id}/comments:
 *   get:
 *     summary: Get task comments
 *     description: Retrieve all comments for a specific task.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskComment'
 */
router.get("/tasks/:id/comments", tc.getComments);

/**
 * @openapi
 * /api/tasks/{id}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     description: Post a new comment on a specific task.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: "string" }
 *     responses:
 *       201:
 *         description: Comment added
 */
router.post("/tasks/:id/comments", tc.addComment);

/**
 * @openapi
 * /api/tasks/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a task comment
 *     description: Remove a comment. Authors can delete their own; Admins can delete any.
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 */
router.delete("/tasks/:id/comments/:commentId", tc.deleteComment);

// ── Time Extension ────────────────────────────────────────────────────────────
// Any authenticated user can request; only admins can approve.
router.post("/tasks/:id/request-extension", tc.requestExtension);
router.post("/tasks/:id/approve-extension", adminOnly, tc.approveExtension);

module.exports = router;
