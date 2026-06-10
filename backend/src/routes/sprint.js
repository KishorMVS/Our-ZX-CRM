const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const c = require("../controllers/sprintController");

router.use(authMiddleware);

const adminOnly = roleMiddleware(["SUPER_ADMIN", "ADMIN"]);

// ── Read (all roles) ──────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/sprints:
 *   get:
 *     summary: Get all sprints
 *     description: Retrieve a list of all sprints.
 *     tags:
 *       - Sprints
 *     responses:
 *       200:
 *         description: List of sprints
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sprint'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", c.getSprints);

/**
 * @openapi
 * /api/sprints/active:
 *   get:
 *     summary: Get active sprint
 *     description: Retrieve the currently active sprint.
 *     tags:
 *       - Sprints
 *     responses:
 *       200:
 *         description: Active sprint details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sprint'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No active sprint found
 *       500:
 *         description: Server error
 */
router.get("/active", c.getActiveSprint);

/**
 * @openapi
 * /api/sprints/backlog:
 *   get:
 *     summary: Get backlog sprints
 *     description: Retrieve sprints that are not yet started.
 *     tags:
 *       - Sprints
 *     responses:
 *       200:
 *         description: List of backlog sprints
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sprint'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/backlog", c.getBacklog);

/**
 * @openapi
 * /api/sprints/{id}/analytics:
 *   get:
 *     summary: Get sprint analytics
 *     description: Retrieve detailed analytics for a specific sprint.
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The sprint ID
 *     responses:
 *       200:
 *         description: Sprint analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sprint: { $ref: '#/components/schemas/Sprint' }
 *                 analytics: { type: "object" }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sprint not found
 *       500:
 *         description: Server error
 */
router.get("/:id/analytics", c.getSprintAnalytics);

/**
 * @openapi
 * /api/sprints/velocity:
 *   get:
 *     summary: Get team velocity
 *     description: Calculate and retrieve the team's velocity based on completed sprints.
 *     tags:
 *       - Sprints
 *     responses:
 *       200:
 *         description: Team velocity data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 velocity: { type: "number" }
 *                 totalPoints: { type: "number" }
 *                 completedSprints: { type: "integer" }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/velocity", c.getTeamVelocity);

// ── Write (admin only) ────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/sprints:
 *   post:
 *     summary: Create a new sprint
 *     description: Plan a new sprint with start and end dates. restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Sprints
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSprintRequest'
 *     responses:
 *       201:
 *         description: Sprint created
 *       403:
 *         description: Forbidden
 */
router.post("/", adminOnly, c.createSprint);

/**
 * @openapi
 * /api/sprints/{id}:
 *   put:
 *     summary: Update sprint details
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSprintRequest'
 *     responses:
 *       200:
 *         description: Sprint updated
 */
router.put("/:id", adminOnly, c.updateSprint);

/**
 * @openapi
 * /api/sprints/{id}:
 *   delete:
 *     summary: Delete a sprint
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sprint deleted
 */
router.delete("/:id", adminOnly, c.deleteSprint);

/**
 * @openapi
 * /api/sprints/{id}/start:
 *   post:
 *     summary: Start a sprint
 *     description: Change sprint status to ACTIVE. Only one sprint can be active at a time.
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sprint started
 *       400:
 *         description: Another sprint is already active
 */
router.post("/:id/start", adminOnly, c.startSprint);

/**
 * @openapi
 * /api/sprints/{id}/complete:
 *   post:
 *     summary: Complete a sprint
 *     description: Change sprint status to COMPLETED. Unfinished tasks remain in backlog.
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sprint completed
 */
router.post("/:id/complete", adminOnly, c.completeSprint);

/**
 * @openapi
 * /api/sprints/{id}/tasks:
 *   post:
 *     summary: Add tasks to sprint
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Tasks added
 */
router.post("/:id/tasks", adminOnly, c.addTasksToSprint);

/**
 * @openapi
 * /api/sprints/{id}/tasks/{taskId}:
 *   delete:
 *     summary: Remove task from sprint
 *     tags:
 *       - Sprints
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task removed
 */
router.delete("/:id/tasks/:taskId", adminOnly, c.removeTaskFromSprint);

module.exports = router;
