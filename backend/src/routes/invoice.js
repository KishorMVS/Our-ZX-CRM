const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
    createInvoice,
    getInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    sendEmail,
    sendSLA,
    addPayment,
    deletePayment,
    getBalanceSheet,
} = require("../controllers/invoiceController");

router.use(authMiddleware);

/**
 * @openapi
 * /api/invoices/balance-sheet:
 *   get:
 *     summary: Get balance sheet
 *     description: Retrieve a summary of total invoiced, received, and outstanding amounts along with a detailed ledger.
 *     tags:
 *       - Invoices
 *     responses:
 *       200:
 *         description: Balance sheet data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BalanceSheet'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/balance-sheet", getBalanceSheet);

/**
 * @openapi
 * /api/invoices:
 *   get:
 *     summary: Get all invoices
 *     description: Retrieve a list of all invoices. Supports filtering by status and type.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by invoice status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by invoice type (e.g., TAX_INVOICE, PROFORMA)
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create an invoice
 *     description: Generate a new invoice or proforma. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Invoices
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvoiceRequest'
 *     responses:
 *       201:
 *         description: Invoice created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       400:
 *         description: Bad Request - Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get("/", getInvoices);
router.post("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), createInvoice);

/**
 * @openapi
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     description: Retrieve detailed information for a specific invoice.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice ID
 *     responses:
 *       200:
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 *   patch:
 *     summary: Update an invoice
 *     description: Modify an existing invoice. Cannot edit invoices already marked as PAID. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvoiceRequest'
 *     responses:
 *       200:
 *         description: Invoice updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       400:
 *         description: Bad Request - Cannot edit a paid invoice
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete an invoice
 *     description: Permanently remove an invoice. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice ID
 *     responses:
 *       200:
 *         description: Invoice deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
router.get("/:id", getInvoice);
router.patch("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateInvoice);
router.delete("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deleteInvoice);

/**
 * @openapi
 * /api/invoices/{id}/send-email:
 *   post:
 *     summary: Send invoice via email
 *     description: Email the invoice to a recipient. Marking it as SENT. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientEmail]
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Invoice sent successfully
 *       400:
 *         description: Bad Request - Missing recipient email
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
router.post("/:id/send-email", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), sendEmail);
router.post("/:id/send-sla", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), sendSLA);

/**
 * @openapi
 * /api/invoices/{id}/payments:
 *   post:
 *     summary: Add a payment entry
 *     description: Record a payment (CREDIT or DEBIT) against an invoice. Updates the invoice status automatically. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentEntry'
 *     responses:
 *       201:
 *         description: Payment recorded
 *       400:
 *         description: Bad Request - Invalid amount
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
router.post("/:id/payments", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), addPayment);

/**
 * @openapi
 * /api/invoices/{id}/payments/{paymentId}:
 *   delete:
 *     summary: Delete a payment entry
 *     description: Remove a payment record and update the invoice status accordingly. Restricted to SUPER_ADMIN and ADMIN.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The invoice ID
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The payment entry ID
 *     responses:
 *       200:
 *         description: Payment deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.delete("/:id/payments/:paymentId", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deletePayment);

module.exports = router;
