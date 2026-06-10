const axios = require("axios");

// ── Cashfree Config ──────────────────────────────────────────────────────────
const CASHFREE_ID     = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_SECRET = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_BASE   =
    process.env.CASHFREE_ENV === "PRODUCTION"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg";

const API_VERSION = "2023-08-01";

const cfHeaders = {
    "x-api-version":  API_VERSION,
    "x-client-id":    CASHFREE_ID,
    "x-client-secret": CASHFREE_SECRET,
    "Content-Type":   "application/json",
};

// Plan catalogue
const PLANS = {
    junior: { name: "Junior Agent", amount: 25000 },
    senior: { name: "Senior Agent", amount: 40000 },
};

// ── POST /api/payments/create-order ──────────────────────────────────────────
exports.createOrder = async (req, res) => {
    try {
        const { plan, customerPhone, returnUrl } = req.body;
        const planData = PLANS[plan];

        if (!planData) {
            return res.status(400).json({ message: "Invalid plan. Use 'junior' or 'senior'." });
        }

        const orderId = `VOICE_${Date.now()}_${plan}`;

        const payload = {
            order_amount:   planData.amount,
            order_currency: "INR",
            order_id:       orderId,
            customer_details: {
                customer_id:    `cust_${req.user.userId}`,
                customer_name:  "CRM User",
                customer_email: "user@zenxai.io",
                customer_phone: customerPhone || "9999999999",
            },
            order_meta: {
                return_url: returnUrl || `${process.env.BACKEND_URL || "http://localhost:5001"}/api/payments/return?order_id={order_id}`,
            },
            order_note: `Voice ${planData.name} purchase`,
        };

        console.log("[Payment] Creating order:", orderId, "plan:", plan, "amount:", planData.amount);

        const response = await axios.post(`${CASHFREE_BASE}/orders`, payload, {
            headers: cfHeaders,
        });

        console.log("[Payment] Order created successfully:", orderId);

        return res.json({
            payment_session_id: response.data.payment_session_id,
            order_id:           orderId,
            plan:               planData.name,
            amount:             planData.amount,
            mode:               process.env.CASHFREE_ENV === "PRODUCTION" ? "production" : "sandbox",
        });
    } catch (error) {
        console.error("[Payment] Create order error:", error?.response?.status, error?.response?.data || error.message);
        return res.status(500).json({
            message: "Failed to create payment order",
            error:   error?.response?.data?.message || error.message,
        });
    }
};

// ── POST /api/payments/verify ────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }

        const response = await axios.get(
            `${CASHFREE_BASE}/orders/${orderId}/payments`,
            { headers: cfHeaders }
        );
        const payments = response.data || [];

        // Check if any payment succeeded
        const successfulPayment = payments.find(
            (p) => p.payment_status === "SUCCESS"
        );

        if (successfulPayment) {
            // Extract plan from orderId  (e.g. "VOICE_1715xxxx_junior")
            const planKey = orderId.split("_").pop();
            const planData = PLANS[planKey] || { name: "Voice Agent", amount: 0 };

            return res.json({
                success:  true,
                plan:     planData.name,
                amount:   planData.amount,
                message:  `Payment verified successfully. You have purchased the ${planData.name}.`,
                payment:  {
                    payment_id:     successfulPayment.cf_payment_id,
                    payment_amount: successfulPayment.payment_amount,
                    payment_time:   successfulPayment.payment_time,
                    payment_method: successfulPayment.payment_group,
                },
            });
        }

        // No successful payment found
        const latestPayment = payments[0];
        return res.json({
            success: false,
            status:  latestPayment?.payment_status || "PENDING",
            message: "Payment not yet completed",
        });
    } catch (error) {
        console.error("[Payment] Verify error:", error?.response?.data || error.message);
        return res.status(500).json({
            message: "Failed to verify payment",
            error:   error?.response?.data?.message || error.message,
        });
    }
};
