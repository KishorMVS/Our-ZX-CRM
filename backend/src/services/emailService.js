const nodemailer = require("nodemailer");
const prisma = require("../utils/prisma");

// ── SMTP host detection from email domain ─────────────────────────────────────
const smtpHostFor = (email) => {
    const d = (email || "").split("@")[1]?.toLowerCase() || "";
    if (d === "gmail.com" || d === "googlemail.com")                     return "smtp.gmail.com";
    if (d === "outlook.com" || d === "hotmail.com" || d === "live.com")  return "smtp.office365.com";
    if (d.includes("yahoo"))                                              return "smtp.mail.yahoo.com";
    return "smtp.gmail.com";
};

// ── Global fallback transporter (from .env) ───────────────────────────────────
const globalTransporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
    },
});

// Build a per-account transporter from raw SMTP creds.
const buildTransporter = (email, password) =>
    nodemailer.createTransport({
        host:   smtpHostFor(email),
        port:   587,
        secure: false,
        auth: { user: email, pass: password },
    });

// ── Transporter resolution: per-user SMTP → per-workspace SMTP → global ───────
// Pass `fromUserId` to send mail from a specific user's own SMTP identity.
const getWorkspaceTransporter = async (workspaceId, fromUserId) => {
    const globalFrom = `"ZenXAI CRM" <${process.env.SMTP_FROM || process.env.SMTP_USER || ""}>`;

    // 1. Per-user SMTP (highest priority — "sent by who created it")
    if (fromUserId) {
        const u = await prisma.user.findUnique({
            where: { id: fromUserId },
            select: { name: true, smtpEmail: true, smtpPassword: true, smtpFromName: true },
        });
        if (u?.smtpEmail && u?.smtpPassword) {
            const fromName = u.smtpFromName || u.name || "CRM";
            return { transporter: buildTransporter(u.smtpEmail, u.smtpPassword), from: `"${fromName}" <${u.smtpEmail}>` };
        }
    }

    if (!workspaceId) return { transporter: globalTransporter, from: globalFrom };

    // 2. Per-workspace SMTP
    const settings = await prisma.companySettings.findFirst({ where: { workspaceId } });
    if (!settings?.smtpEmail || !settings?.smtpPassword) {
        return { transporter: globalTransporter, from: globalFrom };
    }

    const fromName = settings.smtpFromName || settings.companyName || "CRM";
    return { transporter: buildTransporter(settings.smtpEmail, settings.smtpPassword), from: `"${fromName}" <${settings.smtpEmail}>` };
};

// ── Core send ─────────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, text, html, attachments, workspaceId, fromUserId }) => {
    const { transporter, from } = await getWorkspaceTransporter(workspaceId, fromUserId);
    try {
        await transporter.sendMail({
            from, to, subject, text, html,
            ...(attachments ? { attachments } : {}),
        });
        console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
        return true;
    } catch (err) {
        console.error(`[EMAIL ERROR] To: ${to} | Subject: ${subject} | Error:`, err);
        throw err;
    }
};

// ── Test workspace SMTP credentials ──────────────────────────────────────────
const testWorkspaceSmtp = async (workspaceId) => {
    const { transporter } = await getWorkspaceTransporter(workspaceId);
    await transporter.verify();
};

// ── Welcome email (reminder, general) ────────────────────────────────────────
const sendReminderEmail = async (user, reminder) =>
    sendEmail({
        to:      user.email,
        subject: "Reminder: " + reminder.message.substring(0, 30) + "...",
        text:    `Hi ${user.name},\n\nYou have a reminder:\n\n"${reminder.message}"\n\nPlease check your tasks.`,
    });

// ── Lead welcome email (sent when a new lead is captured) ────────────────────
const sendLeadWelcomeEmail = async ({ lead, company, workspaceId }) => {
    if (!lead?.email) return;
    const co     = company || {};
    const coName = co.companyName || "Our Team";

    return sendEmail({
        workspaceId,
        to:      lead.email,
        subject: `Thank you for your enquiry — ${coName}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">${coName}</h1>
  </div>
  <div style="padding:32px 36px;">
    <p style="font-size:16px;color:#111827;font-weight:600;margin:0 0 8px;">Hi ${lead.name || "there"},</p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 16px;">
      Thank you for reaching out to <strong>${coName}</strong>. We've received your enquiry and our team will get back to you shortly.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 24px;">
      We typically respond within 24 hours. In the meantime, feel free to reply to this email with any additional information.
    </p>
    <p style="font-size:14px;font-weight:700;color:#111827;margin:0;">${coName}</p>
  </div>
</div>
</body></html>`
    });
};

const numberToWords = (num) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'only ' : '';
    
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const sendInvoiceEmail = async ({ to, invoice, items, company, workspaceId }) => {
    console.log(`[sendInvoiceEmail] Sending to: ${to} | Invoice: ${invoice?.invoiceNumber}`);
    const co = company || {};
    const coName    = co.companyName || "HEXITE TECHNOLOGIES PRIVATE LIMITED";
    const coGstin   = co.gstin       || "33AAHCH4159D1ZT";
    const coPan     = co.pan         || "—";
    const coAddress = co.address     || "No 98, Varadharajan Street Kaladipet";
    const coCity    = co.city        || "Chennai";
    const coState   = co.state       || "Tamil Nadu";
    const coPincode = co.pincode     || "600019";
    const coPhone   = co.phone       || "+91 9994081905";
    const coEmail   = co.email       || "hello@zenxai.io";
    const bankName  = co.bankName    || "Axis Bank";
    const accountNo = co.accountNo   || "924020046598227";
    const ifsc      = co.ifsc        || "UTIB0001619";
    const branch    = co.branch      || "Thiruvottriyur";
    
    const cgstRate = (items[0]?.taxRate || 18) / 2;
    const sgstRate = (items[0]?.taxRate || 18) / 2;

    const subject = `${invoice.invoiceType === "PROFORMA" ? "Proforma Invoice" : "Tax Invoice"} #${invoice.invoiceNumber} from ${coName}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,sans-serif;">
        <div style="max-width:800px;margin:0 auto;background:#fff;border:2px solid #1f2937;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            
            <!-- HEADER: TYPE -->
            <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1f2937;">
                <tr>
                    <td style="width:33%;"></td>
                    <td style="width:34%;padding:8px;text-align:center;">
                        <div style="font-size:14px;font-weight:900;letter-spacing:6px;color:#1d4ed8;text-transform:uppercase;">
                            ${invoice.invoiceType === "PROFORMA" ? "PROFORMA INVOICE" : "TAX INVOICE"}
                        </div>
                    </td>
                    <td style="width:33%;padding:8px;text-align:right;">
                        <div style="font-size:8px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">ORIGINAL FOR RECIPIENT</div>
                    </td>
                </tr>
            </table>

            <!-- SELLER & META -->
            <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1f2937;">
                <tr>
                    <!-- SELLER DETAILS -->
                    <td style="width:50%;padding:15px;border-right:2px solid #1f2937;vertical-align:top;">
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="width:100px;vertical-align:top;padding-right:15px;">
                                    ${co.logoUrl ? `<img src="cid:company-logo" style="width:90px;max-height:90px;object-fit:contain;" />` : `<div style="width:90px;height:90px;background:#f9fafb;border:1px dashed #d1d5db;text-align:center;line-height:90px;font-size:10px;color:#9ca3af;">LOGO</div>`}
                                </td>
                                <td style="vertical-align:top;">
                                    <div style="font-size:15px;font-weight:900;color:#111827;text-transform:uppercase;margin-bottom:4px;line-height:1.2;">${coName}</div>
                                    <div style="font-size:11px;font-weight:bold;color:#111827;margin-bottom:2px;">GSTIN: ${coGstin}</div>
                                    <div style="font-size:11px;font-weight:bold;color:#111827;margin-bottom:4px;">PAN: ${coPan}</div>
                                    <div style="font-size:11px;color:#4b5563;line-height:1.4;">
                                        ${coAddress}<br />
                                        ${coCity}, ${coState}, ${coPincode}<br />
                                        <div style="margin-top:4px;">
                                            <strong>Mobile:</strong> ${coPhone}<br />
                                            <strong>Email:</strong> ${coEmail}<br />
                                            <strong>Website:</strong> ${co.website || "—"}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                    <!-- INVOICE META -->
                    <td style="width:50%;padding:0;vertical-align:top;">
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="width:50%;padding:12px;border-bottom:2px solid #1f2937;border-right:2px solid #1f2937;">
                                    <div style="font-size:9px;font-weight:bold;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Invoice Number</div>
                                    <div style="font-size:13px;font-weight:900;color:#111827;">${invoice.invoiceNumber}</div>
                                </td>
                                <td style="width:50%;padding:12px;border-bottom:2px solid #1f2937;">
                                    <div style="font-size:9px;font-weight:bold;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Invoice Date</div>
                                    <div style="font-size:13px;font-weight:900;color:#111827;">${new Date(invoice.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</div>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="2" style="padding:12px;">
                                    <div style="font-size:9px;font-weight:bold;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Place of Supply</div>
                                    <div style="font-size:13px;font-weight:900;color:#111827;text-transform:uppercase;">${co.placeOfSupply || "33-TAMIL NADU"}</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- CUSTOMER DETAILS -->
            <div style="padding:15px;border-bottom:2px solid #1f2937;">
                <div style="font-size:11px;font-weight:bold;color:#4b5563;margin-bottom:4px;">Customer Details:</div>
                <div style="font-size:14px;font-weight:900;color:#111827;text-transform:uppercase;margin-bottom:2px;">${invoice.clientName}</div>
                <div style="font-size:11px;color:#111827;"><strong>GSTIN:</strong> ${invoice.clientGstin || "—"} | <strong>PAN:</strong> ${invoice.clientPan || "—"}</div>
                
                <div style="margin-top:10px;font-size:11px;font-weight:bold;color:#4b5563;margin-bottom:2px;">Billing Address:</div>
                <div style="font-size:11px;color:#111827;line-height:1.4;">${(invoice.clientAddress || "—").replace(/\n/g, '<br />')}</div>
            </div>

            <!-- ITEMS TABLE -->
            <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1f2937;">
                <thead>
                    <tr style="border-bottom:2px solid #1f2937;">
                        <th style="padding:10px;border-right:2px solid #1f2937;text-align:left;font-size:11px;font-weight:900;color:#374151;width:30px;">#</th>
                        <th style="padding:10px;border-right:2px solid #1f2937;text-align:left;font-size:11px;font-weight:900;color:#374151;">Item</th>
                        <th style="padding:10px;border-right:2px solid #1f2937;text-align:right;font-size:11px;font-weight:900;color:#374151;width:80px;">Price</th>
                        <th style="padding:10px;border-right:2px solid #1f2937;text-align:right;font-size:11px;font-weight:900;color:#374151;width:90px;">Taxable Value</th>
                        <th style="padding:10px;border-right:2px solid #1f2937;text-align:right;font-size:11px;font-weight:900;color:#374151;width:100px;">Tax Amount</th>
                        <th style="padding:10px;text-align:right;font-size:11px;font-weight:900;color:#374151;width:80px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, i) => `
                    <tr>
                        <td style="padding:10px;border-right:2px solid #1f2937;font-size:11px;color:#111827;vertical-align:top;">${i + 1}</td>
                        <td style="padding:10px;border-right:2px solid #1f2937;font-size:11px;font-weight:bold;color:#111827;vertical-align:top;">${item.description}</td>
                        <td style="padding:10px;border-right:2px solid #1f2937;font-size:11px;text-align:right;color:#111827;vertical-align:top;">${Number(item.price).toFixed(2)}</td>
                        <td style="padding:10px;border-right:2px solid #1f2937;font-size:11px;text-align:right;color:#111827;vertical-align:top;">${Number(item.taxableValue).toFixed(2)}</td>
                        <td style="padding:10px;border-right:2px solid #1f2937;font-size:11px;text-align:right;color:#111827;vertical-align:top;">${Number(item.amount - item.taxableValue).toFixed(2)} (${item.taxRate}%)</td>
                        <td style="padding:10px;font-size:11px;text-align:right;font-weight:bold;color:#111827;vertical-align:top;">${Number(item.amount).toFixed(2)}</td>
                    </tr>`).join("")}
                    <!-- SPACER ROW -->
                    <tr style="height:120px;">
                        <td style="border-right:2px solid #1f2937;"></td>
                        <td style="border-right:2px solid #1f2937;"></td>
                        <td style="border-right:2px solid #1f2937;"></td>
                        <td style="border-right:2px solid #1f2937;"></td>
                        <td style="border-right:2px solid #1f2937;"></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <!-- TOTALS -->
            <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1f2937;">
                <tr>
                    <td style="width:50%;border-right:2px solid #1f2937;"></td>
                    <td style="width:50%;padding:0;vertical-align:top;">
                        <table style="width:100%;border-collapse:collapse;font-size:12px;">
                            <tr>
                                <td style="padding:10px;font-weight:bold;color:#4b5563;">Taxable Amount</td>
                                <td style="padding:10px;text-align:right;font-weight:900;color:#111827;">₹${Number(invoice.subtotal).toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px;font-weight:bold;color:#4b5563;">CGST ${cgstRate.toFixed(1)}%</td>
                                <td style="padding:10px;text-align:right;font-weight:900;color:#111827;">₹${Number(invoice.cgst).toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px;font-weight:bold;color:#4b5563;">SGST ${sgstRate.toFixed(1)}%</td>
                                <td style="padding:10px;text-align:right;font-weight:900;color:#111827;">₹${Number(invoice.sgst).toFixed(2)}</td>
                            </tr>
                            <tr style="border-top:2px solid #1f2937;background:#f9fafb;">
                                <td style="padding:12px 10px;font-size:16px;font-weight:900;color:#111827;text-transform:uppercase;">Total</td>
                                <td style="padding:12px 10px;font-size:18px;font-weight:900;color:#111827;text-align:right;">₹${Number(invoice.total).toFixed(2)}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- WORDS -->
            <div style="padding:10px 15px;border-bottom:2px solid #1f2937;font-size:11px;">
                <span style="color:#4b5563;">Total amount (in words): </span>
                <span style="font-weight:900;color:#111827;">INR ${numberToWords(Math.round(invoice.total))} Only.</span>
            </div>

            ${invoice.paymentLink ? `
            <!-- PAYMENT LINK -->
            <div style="padding:20px; text-align:center; border-bottom:2px solid #1f2937; background:#f0fdf4;">
                <div style="font-size:12px; font-weight:bold; color:#166534; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Fast & Secure Payment</div>
                <a href="${invoice.paymentLink}" target="_blank" style="display:inline-block; padding:12px 30px; background:#16a34a; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:8px; font-size:14px; box-shadow:0 4px 6px rgba(22, 163, 74, 0.2);">
                    PAY ONLINE NOW
                </a>
                <div style="margin-top:10px; font-size:10px; color:#166534;">Click the button above to pay via Cashfree / Razorpay</div>
            </div>
            ` : ""}

            <!-- FOOTER: BANK & SIGN -->
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <!-- BANK -->
                    <td style="width:55%;padding:15px;border-right:2px solid #1f2937;vertical-align:top;min-height:140px;">
                        <div style="font-size:11px;font-weight:bold;color:#4b5563;margin-bottom:8px;">Bank Details:</div>
                        <table style="width:100%;border-collapse:collapse;font-size:11px;color:#111827;line-height:1.6;">
                            <tr><td style="width:90px;color:#6b7280;">Bank:</td><td style="font-weight:900;">${bankName}</td></tr>
                            <tr><td style="color:#6b7280;">Account #:</td><td style="font-weight:900;">${accountNo}</td></tr>
                            <tr><td style="color:#6b7280;">IFSC Code:</td><td style="font-weight:900;">${ifsc}</td></tr>
                            <tr><td style="color:#6b7280;">Branch:</td><td style="font-weight:900;text-transform:uppercase;">${branch}</td></tr>
                        </table>
                    </td>
                    <!-- SIGNATURE -->
                    <td style="width:45%;padding:15px;vertical-align:bottom;text-align:right;">
                        <div style="font-size:11px;font-weight:bold;color:#4b5563;margin-bottom:15px;">For ${coName.toUpperCase()}</div>
                        <div style="height:80px;display:inline-block;vertical-align:bottom;margin-bottom:5px;">
                            ${invoice.signatureUrl ? `<img src="cid:invoice-signature" style="max-height:80px; max-width:200px;" />` : `<div style="height:40px;"></div>`}
                        </div>
                        <div style="font-size:11px;font-weight:900;color:#111827;border-top:1px solid #d1d5db;padding-top:4px;margin-top:5px;">Authorized Signatory</div>
                    </td>
                </tr>
            </table>

            <!-- NOTES -->
            <div style="padding:12px 15px;border-top:2px solid #1f2937;">
                <div style="font-size:11px;font-weight:bold;color:#4b5563;margin-bottom:4px;">Notes:</div>
                <div style="font-size:10px;color:#4b5563;line-height:1.5;">${(invoice.notes || "Payment due within 15 days.").replace(/\n/g, '<br />')}</div>
            </div>

        </div>
    </body>
    </html>`;

    const finalAttachments = [];
    const path = require("path");
    const fs = require("fs");

    if (invoice.signatureUrl) {
        // Convert relative URL to absolute file path
        const sigPath = path.join(__dirname, "../../", invoice.signatureUrl);
        if (fs.existsSync(sigPath)) {
            finalAttachments.push({
                filename: 'signature.png',
                path: sigPath,
                cid: 'invoice-signature'
            });
        }
    }

    if (co.logoUrl) {
        const logoPath = path.join(__dirname, "../../", co.logoUrl);
        if (fs.existsSync(logoPath)) {
            finalAttachments.push({
                filename: 'logo.png',
                path: logoPath,
                cid: 'company-logo'
            });
        }
    }

    return sendEmail({ 
        workspaceId, 
        to, 
        subject, 
        html, 
        text: `Invoice #${invoice.invoiceNumber} — Total: ₹${Number(invoice.total).toFixed(2)}`,
        attachments: finalAttachments
    });
};

// ── SLA email (with PDF attachment) ──────────────────────────────────────────
const sendSLAWithPDF = async ({ to, sla, company, pdfBuffer, message, workspaceId }) => {
    const co     = company || {};
    const coName  = co.companyName || "";
    const coPhone = co.phone       || "";
    const coEmail = co.email       || "";

    const fmtINR  = (n) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0)}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

    const customMsgBlock = message
        ? `<div style="margin-bottom:22px;padding:14px 18px;background:#f8f7ff;border-radius:8px;border:1px solid #e0e7ff;">
               <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;white-space:pre-wrap;">${message}</p>
           </div>`
        : "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px;text-align:center;">
    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,0.65);text-transform:uppercase;">Service Level Agreement</p>
    <p style="margin:0;font-size:22px;font-weight:900;color:#fff;letter-spacing:1px;">${coName || "Service Agreement"}</p>
  </div>
  <div style="padding:32px 36px;">
    <p style="font-size:15px;color:#111827;font-weight:600;margin:0 0 6px;">Dear ${sla.clientName},</p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 20px;">
      Please find attached your <strong>Service Level Agreement (${sla.slaNumber})</strong>${coName ? ` from <strong>${coName}</strong>` : ""}.
      Kindly review the document and revert with any queries.
    </p>
    ${customMsgBlock}
    <div style="background:#f8f7ff;border-radius:8px;border:1px solid #e0e7ff;overflow:hidden;margin-bottom:22px;">
      <div style="padding:10px 16px;background:#4f46e5;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#fff;text-transform:uppercase;">Agreement Summary</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;width:45%;border-bottom:1px solid #e0e7ff;">SLA Reference</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #e0e7ff;">${sla.slaNumber}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Client</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e0e7ff;">${sla.clientName}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Effective Date</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e0e7ff;">${fmtDate(sla.effectiveDate)}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Valid Until</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e0e7ff;">${fmtDate(sla.expiryDate)}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Total Contract Value</td><td style="padding:10px 16px;font-size:14px;color:#4f46e5;font-weight:800;border-bottom:1px solid #e0e7ff;">${fmtINR(sla.totalAmount)}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Advance (50%)</td><td style="padding:10px 16px;font-size:13px;color:#059669;font-weight:700;border-bottom:1px solid #e0e7ff;">${fmtINR(sla.advanceAmount)}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;">Balance (50%)</td><td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:700;">${fmtINR(sla.balanceAmount)}</td></tr>
      </table>
    </div>
    <div style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;padding:14px 18px;margin-bottom:22px;">
      <p style="margin:0;font-size:13px;color:#065f46;line-height:1.65;">
        📎 <strong>The complete SLA document is attached as a PDF.</strong> Please review all terms and payment schedules.
      </p>
    </div>
    ${(coEmail || coPhone) ? `<p style="font-size:13px;color:#374151;margin:0 0 24px;">For queries: ${coEmail ? `📧 <a href="mailto:${coEmail}" style="color:#4f46e5;">${coEmail}</a>` : ""}${coEmail && coPhone ? " &nbsp;|&nbsp; " : ""}${coPhone ? `📞 ${coPhone}` : ""}</p>` : ""}
    <p style="font-size:13px;color:#374151;margin:0 0 4px;">Warm regards,</p>
    <p style="font-size:14px;font-weight:700;color:#111827;margin:0;">${coName || "The Team"}</p>
  </div>
  <div style="padding:14px 36px;background:#f3f4f6;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${sla.slaNumber}${coName ? ` | ${coName}` : ""}${coEmail ? ` | ${coEmail}` : ""}</p>
    <p style="margin:4px 0 0;font-size:10px;color:#d1d5db;">This is an auto-generated email. The SLA is attached as a PDF.</p>
  </div>
</div>
</body></html>`;

    return sendEmail({
        workspaceId,
        to,
        subject: `Service Level Agreement – ${sla.slaNumber}${coName ? ` | ${coName}` : ""}`,
        html,
        text: `Dear ${sla.clientName},\n\nPlease find attached your SLA (${sla.slaNumber})${coName ? ` from ${coName}` : ""}.\n\n${message ? message + "\n\n" : ""}Total: ${fmtINR(sla.totalAmount)}\nAdvance: ${fmtINR(sla.advanceAmount)}\nBalance: ${fmtINR(sla.balanceAmount)}\n\n${coEmail ? `For queries: ${coEmail}` : ""}`,
        attachments: [{ filename: `${sla.slaNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    });
};

const buildSLAEmailHTML = ({ sla, company, message = "" }) => {
    const co     = company || {};
    const coName  = co.companyName || "";
    const coEmail = co.email       || "";
    const coPhone = co.phone       || "";
    const fmtINR  = (n) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0)}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";
    const customMsgBlock = message
        ? `<div style="margin-bottom:22px;padding:14px 18px;background:#f8f7ff;border-radius:8px;border:1px solid #e0e7ff;"><p style="margin:0;font-size:14px;color:#374151;line-height:1.75;white-space:pre-wrap;">${message}</p></div>`
        : "";
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px;text-align:center;">
    <p style="margin:0;font-size:22px;font-weight:900;color:#fff;">${coName || "Service Agreement"}</p>
  </div>
  <div style="padding:32px 36px;">
    <p style="font-size:15px;color:#111827;font-weight:600;margin:0 0 6px;">Dear ${sla.clientName},</p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 20px;">Please find your Service Level Agreement (${sla.slaNumber})${coName ? ` from ${coName}` : ""} attached.</p>
    ${customMsgBlock}
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;">
      <tr style="background:#4f46e5;"><td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#fff;text-transform:uppercase;">Agreement Summary</td></tr>
      <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">SLA Reference</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #e0e7ff;">${sla.slaNumber}</td></tr>
      <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Effective</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e0e7ff;">${fmtDate(sla.effectiveDate)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Expires</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e0e7ff;">${fmtDate(sla.expiryDate)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e0e7ff;">Total Value</td><td style="padding:10px 16px;font-size:14px;color:#4f46e5;font-weight:800;border-bottom:1px solid #e0e7ff;">${fmtINR(sla.totalAmount)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7280;">Advance (50%)</td><td style="padding:10px 16px;font-size:13px;color:#059669;font-weight:700;">${fmtINR(sla.advanceAmount)}</td></tr>
    </table>
    ${coEmail || coPhone ? `<p style="font-size:13px;color:#374151;margin:0 0 24px;">${coEmail ? `📧 ${coEmail}` : ""}${coEmail && coPhone ? " | " : ""}${coPhone ? `📞 ${coPhone}` : ""}</p>` : ""}
    <p style="font-size:14px;font-weight:700;color:#111827;margin:0;">${coName || "The Team"}</p>
  </div>
  <div style="padding:14px 36px;background:#f3f4f6;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${sla.slaNumber}${coEmail ? ` | ${coEmail}` : ""}</p>
  </div>
</div>
</body></html>`;
};

// ── Signing request email — client fills their own details on the signing page ─
const sendSigningRequestEmail = async ({ sla, company, signingUrl, recipientEmail }) => {
    const fmt     = (n) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
    const co      = company || {};
    const required = sla.signaturesRequired || 1;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px #0001;}
  .top{background:#4f46e5;padding:28px 32px;color:#fff;}
  .top h1{margin:0 0 4px;font-size:20px;}
  .top p{margin:0;opacity:.8;font-size:13px;}
  .body{padding:28px 32px;}
  table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;}
  th{text-align:left;color:#64748b;font-weight:600;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;}
  td{padding:8px 10px;border:1px solid #e2e8f0;color:#1e293b;}
  .cta{text-align:center;margin:28px 0;}
  .btn{display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;}
  .note{font-size:12px;color:#94a3b8;margin-top:8px;}
  .info{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;font-size:13px;color:#1e40af;margin-bottom:20px;line-height:1.6;}
  .footer{background:#f8fafc;padding:18px 32px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;}
</style></head><body>
<div class="wrap">
  <div class="top">
    <h1>✍️ Action Required: Sign the SLA</h1>
    <p>${co.companyName || "ZENX CRM"} — ${sla.slaNumber}</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#1e293b;font-weight:600;margin:0 0 14px;">Dear Authorized Signatory,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:20px;">
      You are requested to review and digitally sign the Service Level Agreement listed below.
      Click the button, fill in your details, and sign — it takes less than a minute.
    </p>
    <div class="info">
      ℹ️ <strong>${required} signature${required > 1 ? "s are" : " is"} required</strong> to fully execute this agreement.
      You will fill in your name, designation, and company on the signing page.
    </div>
    <table>
      <tr><th>SLA Number</th><td>${sla.slaNumber}</td></tr>
      <tr><th>Total Value</th><td>₹${fmt(sla.totalAmount)}</td></tr>
      <tr><th>Advance (50%)</th><td>₹${fmt(sla.advanceAmount)}</td></tr>
      <tr><th>Effective Date</th><td>${fmtDate(sla.effectiveDate)}</td></tr>
      <tr><th>Expiry Date</th><td>${fmtDate(sla.expiryDate)}</td></tr>
    </table>
    <div class="cta">
      <a href="${signingUrl}" class="btn">✍️ &nbsp;Open &amp; Sign SLA</a>
      <p class="note">This link expires in 7 days.</p>
    </div>
    <p style="font-size:13px;color:#64748b;">
      If the button doesn't work, copy and paste this link:<br />
      <a href="${signingUrl}" style="color:#4f46e5;word-break:break-all;">${signingUrl}</a>
    </p>
  </div>
  <div class="footer">${co.companyName || "ZENX CRM"} · ${co.address || ""} · ${co.phone || ""}</div>
</div>
</body></html>`;

    await sendEmail({
        to     : recipientEmail,
        subject: `Action Required: Sign SLA ${sla.slaNumber} — ${co.companyName || "ZENX CRM"}`,
        html,
    });
};

// ── Signed confirmation email (admin notified, signers receive copy) ──────────
const sendSignedSLAEmail = async ({ sla, company, signedPdfBuffer, signedAt, adminEmail, signers = [] }) => {
    const co      = company || {};
    const dateStr = new Date(signedAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const timeStr = new Date(signedAt).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
    const fmtAmt  = (n) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0)}`;

    const signerRows = signers.map((s, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td><strong>${s.signerName}</strong></td>
          <td>${s.signerDesignation || "—"}</td>
          <td>${s.signerCompany || "—"}</td>
        </tr>`
    ).join("");

    const attachment = {
        filename   : `${sla.slaNumber}_signed.pdf`,
        content    : signedPdfBuffer,
        contentType: "application/pdf",
    };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px #0001;}
  .top{background:#059669;padding:28px 32px;color:#fff;}
  .top h1{margin:0 0 4px;font-size:20px;}
  .top p{margin:0;opacity:.8;font-size:13px;}
  .body{padding:28px 32px;}
  .badge{display:inline-flex;align-items:center;gap:8px;background:#ecfdf5;color:#059669;
         padding:10px 18px;border-radius:50px;font-weight:700;font-size:14px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;}
  th{text-align:left;color:#64748b;font-weight:600;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;}
  td{padding:8px 10px;border:1px solid #e2e8f0;color:#1e293b;}
  .footer{background:#f8fafc;padding:18px 32px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;}
</style></head><body>
<div class="wrap">
  <div class="top">
    <h1>✅ SLA Fully Signed</h1>
    <p>${co.companyName || "ZENX CRM"} — ${sla.slaNumber}</p>
  </div>
  <div class="body">
    <div class="badge">🔏 Digitally Executed</div>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:16px;">
      All required signatures have been collected for <strong>${sla.slaNumber}</strong>.
      The fully signed copy is attached for your records.
    </p>
    <table>
      <tr><th>SLA Number</th><td>${sla.slaNumber}</td></tr>
      <tr><th>Completed On</th><td>${dateStr} at ${timeStr}</td></tr>
      <tr><th>Total Value</th><td>${fmtAmt(sla.totalAmount)}</td></tr>
      <tr><th>Signatures</th><td>${signers.length}</td></tr>
    </table>
    ${signers.length > 0 ? `
    <p style="font-size:13px;font-weight:600;color:#374151;margin:16px 0 4px;">Signatories:</p>
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Company</th></tr></thead>
      <tbody>${signerRows}</tbody>
    </table>` : ""}
    <p style="font-size:12px;color:#94a3b8;margin-top:16px;">
      The signed SLA PDF is attached. Please keep it for your records.
    </p>
  </div>
  <div class="footer">${co.companyName || "ZENX CRM"} · ${co.address || ""} · ${co.phone || ""}</div>
</div>
</body></html>`;

    const recipients = [];
    if (adminEmail) recipients.push(adminEmail);
    signers.forEach((s) => { if (s.signerEmail && !recipients.includes(s.signerEmail)) recipients.push(s.signerEmail); });
    if (!recipients.length) return;

    await sendEmail({
        to         : recipients.join(", "),
        subject    : `✅ SLA Fully Signed — ${sla.slaNumber}`,
        html,
        attachments: [attachment],
    });
};


// ── Send CRM Brochure email with PDF attachment ─────────────────────────────
const sendCRMBrochureEmail = async ({ lead, company, workspaceId }) => {
    if (!lead?.email) return;
    const co = company || {};
    const coName = co.companyName || "Our Team";
    const path = require("path");
    const fs = require("fs");

    // Relative path to frontend assets folder
    const brochurePath = path.join(__dirname, "../../../frontend/src/assets/CRM broucher.pdf");
    const attachments = [];
    if (fs.existsSync(brochurePath)) {
        attachments.push({
            filename: "CRM Brochure.pdf",
            path: brochurePath,
            contentType: "application/pdf"
        });
    } else {
        console.warn(`[Brochure Email] Brochure file not found at: ${brochurePath}`);
    }

    return sendEmail({
        workspaceId,
        to: lead.email,
        subject: `Here is your CRM Brochure — ${coName}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">${coName}</h1>
  </div>
  <div style="padding:32px 36px;">
    <p style="font-size:16px;color:#111827;font-weight:600;margin:0 0 8px;">Hi ${lead.name || "there"},</p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 16px;">
      Following up on our conversation, we have attached the <strong>CRM Brochure</strong> for your reference.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 24px;">
      Please find the PDF brochure attached to this email. Feel free to review it and reply directly if you have any questions or would like to discuss next steps.
    </p>
    <p style="font-size:14px;font-weight:700;color:#111827;margin:0;">Warm regards,</p>
    <p style="font-size:14px;font-weight:700;color:#4f46e5;margin:4px 0 0;">${coName}</p>
  </div>
</div>
</body></html>`,
        attachments
    });
};

module.exports = {
    sendEmail,
    testWorkspaceSmtp,
    sendReminderEmail,
    sendLeadWelcomeEmail,
    sendInvoiceEmail,
    sendSLAWithPDF,
    buildSLAEmailHTML,
    sendSigningRequestEmail,
    sendSignedSLAEmail,
    sendCRMBrochureEmail,
};
