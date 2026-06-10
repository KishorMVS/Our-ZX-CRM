const express = require("express");
const router  = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { createOrder, verifyPayment } = require("../controllers/paymentController");

router.post("/create-order", authMiddleware, roleMiddleware(["SUPER_ADMIN"]), createOrder);
router.post("/verify",       authMiddleware, roleMiddleware(["SUPER_ADMIN"]), verifyPayment);

module.exports = router;
