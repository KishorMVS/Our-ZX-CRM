const path = require("path");
const fs = require("fs");
const prisma = require("../utils/prisma");
const { randomUUID } = require("crypto");
const { sendSigningRequestEmail } = require("../services/emailService");
const { generateSLAPDF, generateSLAPDFFromTemplate } = require("../services/pdfService");

const SIGNED_DIR = path.join(__dirname, "../../uploads/signed-slas");
if (!fs.existsSync(SIGNED_DIR)) fs.mkdirSync(SIGNED_DIR, { recursive: true });

const generateSLANumber = async () => {
    const latest = await prisma.sLA.findFirst({ orderBy: { createdAt: "desc" } });
    if (!latest) return "SLA-1";
    const last = parseInt(latest.slaNumber.split("-")[1]) || 0;
    return `SLA-${last + 1}`;
};

// ── Create SLA + generate signing link + (optionally) send email ──────────────
const createSLA = async (req, res) => {
    try {
        const { userId } = req.user;
        const {
            services = [],
            notes,
            signaturesRequired = 1,
            recipientEmail,   // where to email the link (optional)
            templateId,       // which template to use on the signing page
        } = req.body;

        if (!services.length) return res.status(400).json({ message: "At least one service is required" });
        const sigsNeeded = Math.max(1, parseInt(signaturesRequired) || 1);

        // Entered service values are the taxable (base) amount; GST is ADDED on top.
        const company = await prisma.companySettings.findFirst();
        const gstRate = (company && typeof company.defaultTaxRate === "number") ? company.defaultTaxRate : 18;
        const baseAmount    = services.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
        const gstAmount     = parseFloat((baseAmount * gstRate / 100).toFixed(2));
        const totalAmount   = parseFloat((baseAmount + gstAmount).toFixed(2));
        const advanceAmount = parseFloat((totalAmount * 0.5).toFixed(2));
        const balanceAmount = parseFloat((totalAmount - advanceAmount).toFixed(2));

        const effectiveDate = new Date();
        const expiryDate = new Date(effectiveDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        const slaNumber = await generateSLANumber();
        const token = randomUUID();
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim();
        const signingUrl = `${frontendBase}/sign/${token}`;

        const sla = await prisma.sLA.create({
            data: {
                slaNumber,
                services,
                totalAmount,
                advanceAmount,
                balanceAmount,
                effectiveDate,
                expiryDate,
                notes,
                status: "PENDING_SIGNATURE",
                signingToken: token,
                signingTokenExpiry: expiry,
                signingUrl,
                signaturesRequired: sigsNeeded,
                templateId: templateId || null,
                emailSentTo: recipientEmail || null,
                emailSentAt: recipientEmail ? new Date() : null,
                createdById: userId,
            },
            include: { createdBy: { select: { id: true, name: true, email: true } } },
        });

        // Send ONE email with the signing link if a recipient was provided
        if (recipientEmail) {
            await sendSigningRequestEmail({ sla, company, signingUrl, recipientEmail });
        }

        res.status(201).json({ ...sla, signingUrl });
    } catch (error) {
        res.status(500).json({ message: "Error creating SLA", error: error.message });
    }
};

const getSLAs = async (_, res) => {
    try {
        const slas = await prisma.sLA.findMany({
            include: {
                createdBy: { select: { id: true, name: true } },
                SLASignature: { orderBy: { slot: "asc" } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(slas);
    } catch (error) {
        res.status(500).json({ message: "Error fetching SLAs", error: error.message });
    }
};

const getSLA = async (req, res) => {
    try {
        const sla = await prisma.sLA.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true } },
                SLASignature: { orderBy: { slot: "asc" } },
            },
        });
        if (!sla) return res.status(404).json({ message: "SLA not found" });
        res.json(sla);
    } catch (error) {
        res.status(500).json({ message: "Error fetching SLA", error: error.message });
    }
};

const deleteSLA = async (req, res) => {
    try {
        const existing = await prisma.sLA.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: "SLA not found" });
        await prisma.sLA.delete({ where: { id: req.params.id } });
        res.json({ message: "SLA deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting SLA", error: error.message });
    }
};

const sendSLA = async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.user;
        const { recipientEmail, message } = req.body;

        if (!recipientEmail) return res.status(400).json({ message: "Recipient email is required" });

        const [sla, company] = await Promise.all([
            prisma.sLA.findFirst({
                where: {
                    id,
                    ...(workspaceId ? { createdBy: { workspaceId } } : {}),
                },
            }),
            prisma.companySettings.findFirst({
                where: workspaceId ? { workspaceId } : {},
            }),
        ]);
        if (!sla) return res.status(404).json({ message: "SLA not found" });

        let pdfBuffer;
        if (req.body.templateId) {
            const template = await prisma.sLATemplate.findUnique({ where: { id: req.body.templateId } });
            if (!template) return res.status(404).json({ message: "Template not found" });
            pdfBuffer = await generateSLAPDFFromTemplate({ sla, company, templatePath: template.filePath });
        } else {
            pdfBuffer = await generateSLAPDF({ sla, company });
        }

        await sendSLAWithPDF({
            to: recipientEmail,
            sla,
            company,
            pdfBuffer,
            message: message || "",
            workspaceId,
        });

        await prisma.sLA.update({
            where: { id },
            data: { emailSentAt: new Date(), emailSentTo: recipientEmail, status: "SENT" },
        });

        res.json({ message: "SLA sent successfully", sentTo: recipientEmail });
    } catch (error) {
        res.status(500).json({ message: "Error sending SLA", error: error.message });
    }
};

const previewDraft = async (req, res) => {
    try {
        const { workspaceId } = req.user;
        const { clientName, clientEmail, clientPhone, clientAddress, services = [], notes, templateId, message } = req.body;

        if (!clientName) return res.status(400).json({ message: "Client name is required" });
        if (!services.length) return res.status(400).json({ message: "At least one service is required" });

        const totalAmount = services.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
        const advanceAmount = parseFloat((totalAmount * 0.5).toFixed(2));
        const balanceAmount = parseFloat((totalAmount - advanceAmount).toFixed(2));
        const effectiveDate = new Date();
        const expiryDate = new Date(effectiveDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        const mockSLA = {
            slaNumber: "PREVIEW",
            clientName,
            clientEmail: clientEmail || "",
            clientPhone: clientPhone || "",
            clientAddress: clientAddress || "",
            services,
            totalAmount,
            advanceAmount,
            balanceAmount,
            effectiveDate,
            expiryDate,
            notes: notes || "",
        };

        const company = await prisma.companySettings.findFirst({
            where: workspaceId ? { workspaceId } : {},
        });

        let pdfBuffer;
        if (templateId) {
            const template = await prisma.sLATemplate.findUnique({ where: { id: templateId } });
            if (!template) return res.status(404).json({ message: "Template not found" });
            pdfBuffer = await generateSLAPDFFromTemplate({ sla: mockSLA, company, templatePath: template.filePath });
        } else {
            pdfBuffer = await generateSLAPDF({ sla: mockSLA, company });
        }

        const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
        const emailHtml = buildSLAEmailHTML({ sla: mockSLA, company, message: message || "" });

        res.json({ pdfBase64, emailHtml });
    } catch (error) {
        res.status(500).json({ message: "Error generating preview", error: error.message });
    }
};

const updateSLA = async (req, res) => {
    try {
        const { id } = req.params;
        const { services = [], notes, signaturesRequired } = req.body;

        if (!services.length) return res.status(400).json({ message: "At least one service is required" });

        const company = await prisma.companySettings.findFirst();
        const gstRate = (company && typeof company.defaultTaxRate === "number") ? company.defaultTaxRate : 18;
        const baseAmount    = services.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
        const gstAmount     = parseFloat((baseAmount * gstRate / 100).toFixed(2));
        const totalAmount   = parseFloat((baseAmount + gstAmount).toFixed(2));
        const advanceAmount = parseFloat((totalAmount * 0.5).toFixed(2));
        const balanceAmount = parseFloat((totalAmount - advanceAmount).toFixed(2));

        const data = { services, totalAmount, advanceAmount, balanceAmount, notes };
        if (signaturesRequired) data.signaturesRequired = Math.max(1, parseInt(signaturesRequired));

        const sla = await prisma.sLA.update({ where: { id }, data });
        res.json(sla);
    } catch (error) {
        res.status(500).json({ message: "Error updating SLA", error: error.message });
    }
};

// ── Resend signing link (regenerates token) ───────────────────────────────────
const resendSigningLink = async (req, res) => {
    try {
        const { id } = req.params;
        const { recipientEmail } = req.body;

        const [sla, company] = await Promise.all([
            prisma.sLA.findUnique({ where: { id } }),
            prisma.companySettings.findFirst(),
        ]);
        if (!sla) return res.status(404).json({ message: "SLA not found" });
        if (sla.status === "SIGNED") return res.status(400).json({ message: "SLA already fully signed" });

        const token = randomUUID();
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim();
        const signingUrl = `${frontendBase}/sign/${token}`;

        const updated = await prisma.sLA.update({
            where: { id },
            data: {
                signingToken: token,
                signingTokenExpiry: expiry,
                signingUrl,
                ...(recipientEmail ? { emailSentTo: recipientEmail, emailSentAt: new Date() } : {}),
            },
        });

        const emailTo = recipientEmail || sla.emailSentTo;
        if (emailTo) {
            await sendSigningRequestEmail({ sla: updated, company, signingUrl, recipientEmail: emailTo });
        }

        res.json({ message: "Signing link resent", signingUrl });
    } catch (error) {
        res.status(500).json({ message: "Error resending signing link", error: error.message });
    }
};

// ── Download the completed signed PDF ────────────────────────────────────────
const downloadSignedSla = async (req, res) => {
    try {
        const sla = await prisma.sLA.findUnique({ where: { id: req.params.id } });
        if (!sla) return res.status(404).json({ message: "SLA not found" });
        if (sla.status !== "SIGNED") return res.status(400).json({ message: "SLA has not been signed yet" });

        if (!sla.signedPdfPath || !fs.existsSync(sla.signedPdfPath))
            return res.status(404).json({ message: "Signed PDF not available" });

        return res.download(
            sla.signedPdfPath,
            `${sla.slaNumber}_signed.pdf`,
            { headers: { "Content-Type": "application/pdf" } }
        );
    } catch (error) {
        res.status(500).json({ message: "Error downloading signed PDF", error: error.message });
    }
};

// ── Preview PDF (no SLA created) ─────────────────────────────────────────────
const previewSLA = async (req, res) => {
    try {
        const { services = [], notes, templateId } = req.body;
        const company = await prisma.companySettings.findFirst();

        const gstRate = (company && typeof company.defaultTaxRate === "number") ? company.defaultTaxRate : 18;
        const base    = services.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const total   = parseFloat((base * (1 + gstRate / 100)).toFixed(2));
        const sla = {
            slaNumber: "PREVIEW",
            services,
            notes: notes || "",
            totalAmount: total,
            advanceAmount: parseFloat((total * 0.5).toFixed(2)),
            balanceAmount: parseFloat((total * 0.5).toFixed(2)),
            effectiveDate: new Date(),
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            clientName: "Client Name",
            clientEmail: "",
            clientAddress: "",
        };

        let pdfBuffer;
        if (templateId) {
            const template = await prisma.sLATemplate.findUnique({ where: { id: templateId } });
            if (template && fs.existsSync(template.filePath))
                pdfBuffer = await generateSLAPDFFromTemplate({ sla, company, templatePath: template.filePath });
        }
        if (!pdfBuffer) pdfBuffer = await generateSLAPDF({ sla, company });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="SLA_preview.pdf"`);
        res.send(Buffer.from(pdfBuffer));
    } catch (error) {
        res.status(500).json({ message: "Error generating preview", error: error.message });
    }
};

module.exports = { createSLA, getSLAs, getSLA, deleteSLA, updateSLA, resendSigningLink, downloadSignedSla, previewSLA };
