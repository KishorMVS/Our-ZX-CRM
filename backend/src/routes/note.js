const express = require("express");
const router = express.Router();
const noteController = require("../controllers/noteController");
const authMiddleware = require("../middleware/authMiddleware");

// Notes API
/**
 * @openapi
 * /api/leads/{leadId}/notes:
 *   post:
 *     summary: Add a note to a lead
 *     description: Create a new note for a specific lead.
 *     tags:
 *       - Notes
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         description: The lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNoteRequest'
 *     responses:
 *       201:
 *         description: Note added successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all notes for a lead
 *     description: Retrieve a list of all notes associated with a specific lead.
 *     tags:
 *       - Notes
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         description: The lead ID
 *     responses:
 *       200:
 *         description: List of notes
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.post("/leads/:leadId/notes", authMiddleware, noteController.createNote);
router.get("/leads/:leadId/notes", authMiddleware, noteController.getNotes);

module.exports = router;
