const express = require("express");
const router = express.Router();
const reminderController = require("../controllers/reminderController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/reminders:
 *   post:
 *     summary: Create a reminder
 *     description: Create a new reminder for a specific lead.
 *     tags:
 *       - Reminders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReminderRequest'
 *     responses:
 *       201:
 *         description: Reminder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 reminder: { $ref: "#/components/schemas/Reminder" }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get my reminders
 *     description: Retrieve a list of all reminders for the current user.
 *     tags:
 *       - Reminders
 *     responses:
 *       200:
 *         description: List of reminders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reminder'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", reminderController.createReminder);

/**
 * @openapi
 * /api/reminders:
 *   get:
 *     summary: Get my reminders
 *     description: Retrieve all reminders for the authenticated user, sorted by date.
 *     tags:
 *       - Reminders
 *     responses:
 *       200:
 *         description: List of reminders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reminder'
 */
router.get("/", reminderController.getMyReminders);

/**
 * @openapi
 * /api/reminders/{id}:
 *   patch:
 *     summary: Update reminder status
 *     description: Mark a reminder as completed or update its details.
 *     tags:
 *       - Reminders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reminder updated
 */
router.patch("/:id", reminderController.updateReminder);

/**
 * @openapi
 * /api/reminders/{id}:
 *   delete:
 *     summary: Delete a reminder
 *     tags:
 *       - Reminders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reminder deleted
 */
router.delete("/:id", reminderController.deleteReminder);

module.exports = router;
