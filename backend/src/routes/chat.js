const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/chat/token:
 *   post:
 *     summary: Generate chat token
 *     description: Get a JWT token for the current user to authenticate with the Stream Chat client.
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: Chat token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 apiKey: { type: string }
 */
router.post("/token", chatController.createToken);

/**
 * @openapi
 * /api/chat/group:
 *   post:
 *     summary: Create a group chat channel
 *     description: Admins can create multi-user chat rooms.
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, members]
 *             properties:
 *               name: { type: string }
 *               members: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Group channel created
 *       403:
 *         description: Forbidden (Admin only)
 */
// Group creation is gated inside the controller via the effective chat-permission
// helper (Admin/Super Admin always; Team Lead only when granted canCreateGroup).
router.post("/group", chatController.createGroupChannel);

/**
 * @openapi
 * /api/chat/call-precheck/{userId}:
 *   get:
 *     summary: Presence precheck before a 1:1 call
 *     description: Returns the target's live online status (ONLINE/BREAK/OFFLINE) so the caller can gate the call.
 *     tags: [Chat]
 *     responses:
 *       200: { description: Target presence }
 *       403: { description: Target is in a different workspace }
 */
router.get("/call-precheck/:userId", chatController.callPrecheck);

/**
 * @openapi
 * /api/chat/call-event:
 *   post:
 *     summary: Log a call event and post an inline call bubble
 *     tags: [Chat]
 *     responses:
 *       200: { description: Call event logged }
 */
router.post("/call-event", chatController.logCallEvent);

/**
 * @openapi
 * /api/chat/start:
 *   post:
 *     summary: Start a direct chat
 *     description: Initialize a 1-on-1 conversation. Automatically syncs users to Stream if needed.
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId: { type: string }
 *     responses:
 *       200:
 *         description: Direct chat initialized
 */
router.post("/start", chatController.startDirectChat);

/**
 * @openapi
 * /api/chat/users:
 *   get:
 *     summary: Get users for chat search
 *     description: Retrieve a list of users available to start a conversation with.
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: List of chat-ready users
 */
router.get("/users", chatController.getUsersForChat);

/**
 * @openapi
 * /api/chat/sync-user:
 *   post:
 *     summary: Sync current user to Stream
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: User synced successfully
 */
router.post("/sync-user", chatController.syncUserToStream);

/**
 * @openapi
 * /api/chat/sync-all-users:
 *   post:
 *     summary: Sync all system users to Stream
 *     description: Administrative tool to batch sync all existing users to the chat platform. Super Admin only.
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: Bulk sync completed
 *       403:
 *         description: Forbidden
 */
router.post("/sync-all-users", roleMiddleware(["SUPER_ADMIN"]), chatController.syncAllUsers);
router.delete("/delete-channel", chatController.deleteChannel);

// Rename a group channel — gated to the creator or a CRM admin inside the controller.
router.patch("/group-name", chatController.renameGroup);

module.exports = router;
