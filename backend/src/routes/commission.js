const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/commissionController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * @openapi
 * /api/commission:
 *   get:
 *     summary: Get commission logs
 *     description: Retrieve all commission logs for the current user.
 *     tags:
 *       - Commission
 *     responses:
 *       200:
 *         description: Commission logs
 */
router.get("/", commissionController.getCommissions);

module.exports = router;
