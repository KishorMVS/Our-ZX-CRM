const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

// Register (Public or Admin protected? Ideally protected but keeping open for initial setup if needed, or check app logic)
// Based on typical flows, register might be public, but here userController.registerUser exists.
// Let's keep existing logic if any, but adding new protected routes.

/**
 * @openapi
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account. Restricted based on system settings.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 *       500:
 *         description: Server error
 */
router.post("/register", userController.registerUser);

// Protected Routes
router.use(authMiddleware);

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all active users
 *     description: Retrieve a list of all active users.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get("/", userController.getAllUsers);

/**
 * @openapi
 * /api/users/profile:
 *   patch:
 *     summary: Update current user profile
 *     description: Modify name, phone, or department of the authenticated user.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.patch("/profile", userController.updateProfile);

/**
 * @openapi
 * /api/users/password:
 *   patch:
 *     summary: Change user password
 *     description: Update the password for the current user.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Incorrect current password
 *       401:
 *         description: Unauthorized
 */
router.patch("/password", userController.changePassword);

/**
 * @openapi
 * /api/users/preferences:
 *   patch:
 *     summary: Update user preferences
 *     description: Change UI or system preferences for the current user.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: object
 *                 example: { "theme": "dark", "notifications": true }
 *     responses:
 *       200:
 *         description: Preferences updated
 *       401:
 *         description: Unauthorized
 */
router.patch("/preferences", userController.updatePreferences);

module.exports = router;
