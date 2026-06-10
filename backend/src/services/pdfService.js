const puppeteer = require("puppeteer-core");
const fs = require("fs");

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const buildSLAHtml = ({ sla, company }) => {
    const co = company || {};
    const coName    = co.companyName || "Hexite Technologies Private Limited";
    const coAddress = co.address     || "No 98, Varadharajan Street Kaladipet";
    const coCity    = `${co.city || "Chennai"}, ${co.state || "Tamil Nadu"} - ${co.pincode || "600019"}`;
    const coPhone   = co.phone       || "+91 9994081905";
    const coEmail   = co.email       || "praveen@hexitetechnologies.com";

    const effectiveDate = new Date(sla.effectiveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const expiryDate    = new Date(sla.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

    const fmtINR = (n) => `INR ${new Intl.NumberFormat("en-IN").format(n || 0)}`;
    const fmtINR2 = (n) => `INR ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
    const services = Array.isArray(sla.services) ? sla.services : [];

    // ── GST breakdown (stored total is GST-inclusive) ────────────────────────────
    const gstRate    = (co && typeof co.defaultTaxRate === "number") ? co.defaultTaxRate : 18;
    const gstin      = (co && co.gstin) || "";
    const grandTotal = Number(sla.totalAmount) || 0;
    const baseAmount = gstRate > 0 ? grandTotal / (1 + gstRate / 100) : grandTotal;
    const gstAmount  = grandTotal - baseAmount;
    const cgst       = gstAmount / 2;
    const sgst       = gstAmount / 2;
    const halfRate   = gstRate / 2;

    const serviceRows = services.map((s, i) => `
        <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${i + 1}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${s.description || ""}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;text-align:right;font-weight:600;">₹${Number(s.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>`).join("");

    const row2 = (label, val) =>
        `<tr><td style="padding:8px 14px;font-weight:600;color:#374151;font-size:13px;width:45%;border-bottom:1px solid #f3f4f6;background:#fafafa;">${label}</td><td style="padding:8px 14px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${val}</td></tr>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SLA – ${sla.slaNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; color: #111827; }
  h2 { font-size: 14px; font-weight: 700; color: #4f46e5; text-transform: uppercase;
       letter-spacing: 0.5px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px; margin-bottom: 10px; }
  p { font-size: 13px; color: #374151; line-height: 1.75; margin-bottom: 10px; }
  ul { margin: 0 0 10px; padding-left: 20px; font-size: 13px; color: #374151; line-height: 2; }
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto;padding:0;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 44px;color:#fff;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;opacity:0.75;margin-bottom:6px;">SERVICE LEVEL AGREEMENT</div>
      <div style="font-size:26px;font-weight:900;letter-spacing:2px;">ZENVOICE PLATFORM</div>
      <div style="font-size:11px;opacity:0.7;margin-top:4px;letter-spacing:1px;">Powered by ZENXAI &nbsp;|&nbsp; ${coName}</div>
    </div>
    <div style="display:flex;justify-content:center;gap:48px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.2);font-size:12px;opacity:0.9;">
      <div><span style="opacity:0.65;">Ref: </span><strong>${sla.slaNumber}</strong></div>
      <div><span style="opacity:0.65;">Effective: </span><strong>${effectiveDate}</strong></div>
      <div><span style="opacity:0.65;">Term: </span><strong>One (1) Year</strong></div>
      <div><span style="opacity:0.65;">Expires: </span><strong>${expiryDate}</strong></div>
    </div>
  </div>

  <div style="padding:36px 44px;">

    <!-- Parties -->
    <div style="display:flex;gap:24px;margin-bottom:28px;">
      <div style="flex:1;padding:16px 18px;background:#f8f7ff;border-radius:8px;border:1px solid #e0e7ff;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;">Service Provider</p>
        <p style="margin:0 0 2px;font-weight:800;color:#111827;font-size:14px;">${coName}</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:12px;">${coAddress}, ${coCity}</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:12px;">${coPhone} &nbsp;|&nbsp; ${coEmail}</p>
        ${gstin ? `<p style="margin:0 0 2px;color:#6b7280;font-size:12px;">GSTIN: <strong>${gstin}</strong></p>` : ""}
        <p style="margin:4px 0 0;font-size:11px;color:#7c3aed;font-weight:600;">(hereinafter "Service Provider")</p>
      </div>
      <div style="flex:1;padding:16px 18px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;">Client</p>
        <p style="margin:0 0 2px;font-weight:800;color:#111827;font-size:14px;">${sla.clientName}</p>
        ${sla.clientAddress ? `<p style="margin:0 0 2px;color:#6b7280;font-size:12px;">${sla.clientAddress}</p>` : ""}
        ${sla.clientPhone ? `<p style="margin:0 0 2px;color:#6b7280;font-size:12px;">${sla.clientPhone}</p>` : ""}
        <p style="margin:0 0 2px;color:#6b7280;font-size:12px;">${sla.clientEmail}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#059669;font-weight:600;">(hereinafter "Client")</p>
      </div>
    </div>

    <!-- Preamble -->
    <div style="margin-bottom:24px;padding:14px 18px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;">
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.75;">
        This Service Level Agreement ("<strong>Agreement</strong>") is made and entered into on <strong>${effectiveDate}</strong>, by and between
        <strong>${coName}</strong> (the "<strong>Service Provider</strong>") and <strong>${sla.clientName}</strong>${sla.clientAddress ? `, having its registered office at ${sla.clientAddress}` : ""}
        (the "<strong>Client</strong>"). The Service Provider and the Client are collectively referred to as the "<strong>Parties</strong>."
      </p>
    </div>

    <!-- Purpose -->
    <div style="margin-bottom:22px;">
      <h2>Purpose</h2>
      <p>This SLA defines the understanding between <strong>${coName}</strong> (HEXITE) and <strong>${sla.clientName}</strong> (Client) for the deployment and maintenance of the <strong>ZENVOICE</strong> platform powered by <strong>ZENXAI</strong>, HEXITE's proprietary AI and automation framework.</p>
      <p>The objective is to deliver a fully functional conversational commerce and telephony automation platform, including end-to-end deployment, support, and maintenance throughout the agreed term.</p>
    </div>

    <!-- Scope -->
    <div style="margin-bottom:22px;">
      <h2>Scope of Services</h2>
      <p>HEXITE shall deliver a complete, single-phase deployment with the following deliverables:</p>
      <ul>
        <li>End-to-end deployment of the ZENVOICE platform</li>
        <li>Setup of telephony automation using Telecmi for inbound and outbound communication</li>
        <li>Implementation of AI-driven conversational workflows using ZENXAI</li>
        <li>Development of analytics and performance dashboards</li>
        <li>Integration with CRM systems, payment gateways, and relevant APIs</li>
        <li>Branding and white-label customization as per Client requirements</li>
        <li>System training and onboarding for the Client's team</li>
        <li>Delivery of documentation and usage guidelines</li>
        <li>Ongoing platform maintenance, optimization, and updates during the SLA term</li>
      </ul>
    </div>

    <!-- Contracted Services -->
    <div style="margin-bottom:22px;">
      <h2>Contracted Services – ${sla.slaNumber}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;">#</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;">Service / Description</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;color:#6b7280;font-weight:700;">Value</th>
          </tr>
        </thead>
        <tbody>${serviceRows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;">
            <td colspan="2" style="padding:9px 14px;font-weight:600;color:#374151;font-size:12px;text-align:right;">Subtotal (Taxable Value)</td>
            <td style="padding:9px 14px;text-align:right;font-weight:600;color:#374151;font-size:12px;">${fmtINR2(baseAmount)}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td colspan="2" style="padding:9px 14px;color:#374151;font-size:12px;text-align:right;">CGST @ ${halfRate}%</td>
            <td style="padding:9px 14px;text-align:right;color:#374151;font-size:12px;">${fmtINR2(cgst)}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td colspan="2" style="padding:9px 14px;color:#374151;font-size:12px;text-align:right;">SGST @ ${halfRate}%</td>
            <td style="padding:9px 14px;text-align:right;color:#374151;font-size:12px;">${fmtINR2(sgst)}</td>
          </tr>
          <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed);">
            <td colspan="2" style="padding:12px 14px;font-weight:700;color:#fff;font-size:13px;">Total Contract Value (Inclusive of GST @ ${gstRate}%)</td>
            <td style="padding:12px 14px;text-align:right;font-weight:800;color:#fff;font-size:15px;">${fmtINR2(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Product Inclusions -->
    <div style="margin-bottom:22px;">
      <h2>Product Inclusions</h2>
      <p><strong>${sla.clientName}</strong> will receive full access to the Zenvoice Dashboard, integrated with ZENXAI for backend automation, analytics, and AI-driven process control.</p>
      <p>As part of this agreement, <strong>10,00,000 worth of ZENXAI credits</strong> will be provided for platform usage, automations, and message/API-based operations during the SLA term.</p>
      <p>HEXITE will provide system training, onboarding, and ongoing enhancements throughout the contract period.</p>
    </div>

    <!-- Commercial Terms -->
    <div style="margin-bottom:22px;">
      <h2>Commercial Terms</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        ${row2("Total Project Cost (Incl. GST)", `<strong>${fmtINR(sla.totalAmount)}</strong>`)}
        ${row2("Advance Payment (50%)", `<strong>${fmtINR(sla.advanceAmount)}</strong> — payable before project commencement`)}
        ${row2("Balance Payment (50%)", `<strong>${fmtINR(sla.balanceAmount)}</strong> — payable after two weeks of commencement`)}
        ${row2("Wallet Credit Benefit", "50,000 credits added as fueling charges")}
        ${row2("Call Fueling Charges", "INR 3.85 + applicable GST per minute")}
        ${row2("AWS Hosting Support", "Up to $1,000 in AWS credits for infrastructure setup")}
      </table>
      <div style="padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-bottom:8px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#065f46;">Second Year Fee Waiver (Performance-Based)</p>
        <p style="margin:0;font-size:12px;color:#374151;line-height:1.6;">The platform fee for the second year shall be <strong>fully waived</strong> if the Client generates revenue of <strong>INR 5,00,000 to INR 10,00,000</strong> within the first 12 months. In the event the minimum revenue threshold is not achieved, standard renewal charges apply.</p>
      </div>
      <p style="font-size:13px;">All fees are exclusive of applicable taxes. Additional features outside the defined scope will be quoted separately.</p>
    </div>

    <!-- Platform & Technology -->
    <div style="margin-bottom:22px;">
      <h2>Platform &amp; Technology</h2>
      <table style="width:100%;border-collapse:collapse;">
        ${row2("Telephony", "Telecmi Cloud Telephony")}
        ${row2("AI &amp; Automation", "ZENXAI Platform")}
        ${row2("Hosting", "AWS Cloud Infrastructure")}
        ${row2("Dashboard", "Custom-built ZENXAI-powered analytics interface")}
      </table>
    </div>

    <!-- Roles -->
    <div style="margin-bottom:22px;">
      <h2>Roles &amp; Responsibilities</h2>
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">HEXITE Responsibilities:</p>
      <ul>
        <li>Complete platform setup, configuration, and deployment</li>
        <li>Providing onboarding and training for system usage</li>
        <li>Allocation of ZENXAI credits for operational usage</li>
        <li>Ongoing technical support, system monitoring, and maintenance</li>
        <li>Assistance in securing AWS infrastructure credits</li>
        <li>Delivery of services as per agreed timelines</li>
      </ul>
      <p style="font-weight:700;font-size:13px;margin:8px 0 4px;">Client Responsibilities:</p>
      <ul>
        <li>Managing AWS hosting infrastructure (with HEXITE support)</li>
        <li>Maintaining and funding the Telecmi telephony account</li>
        <li>Ensuring timely payments as per agreed terms</li>
        <li>Providing required credentials, brand assets, and inputs</li>
        <li>Participating in testing, feedback, and approval processes</li>
      </ul>
    </div>

    <!-- Billing -->
    <div style="margin-bottom:22px;">
      <h2>Billing &amp; Payments</h2>
      <ul>
        <li>All invoices shall be raised by <strong>${coName}</strong></li>
        <li>Payments must be made within the agreed timelines</li>
        <li>Monthly usage charges (telephony, etc.) will be billed separately</li>
        <li>Delays in payment may result in service suspension</li>
      </ul>
    </div>

    <!-- Confidentiality -->
    <div style="margin-bottom:22px;">
      <h2>Confidentiality &amp; NDA</h2>
      <ul>
        <li>Both parties agree to maintain strict confidentiality of all shared information</li>
        <li>Confidential information includes technical data, workflows, financial details, and business processes</li>
        <li>This obligation shall remain valid for <strong>three (3) years</strong> post termination</li>
        <li>Any breach may result in termination and legal action</li>
      </ul>
    </div>

    <!-- IP -->
    <div style="margin-bottom:22px;">
      <h2>Intellectual Property &amp; License</h2>
      <ul>
        <li>All platforms, frameworks, AI systems, and code remain the intellectual property of HEXITE</li>
        <li>The Client is granted a non-exclusive, non-transferable license for usage during the agreement period</li>
        <li>All branding, logos, and content provided by the Client remain their property</li>
      </ul>
    </div>

    <!-- Termination -->
    <div style="margin-bottom:22px;">
      <h2>Termination Clause</h2>
      <ul>
        <li>Either party may terminate this agreement with a <strong>30-day written notice</strong></li>
        <li>All outstanding payments must be cleared prior to termination</li>
        <li>Upon termination, access to the platform will be revoked</li>
        <li>Unused credits are non-refundable and non-transferable</li>
      </ul>
    </div>

    <!-- Governing Law -->
    <div style="margin-bottom:28px;">
      <h2>Governing Law &amp; Jurisdiction</h2>
      <p>This Agreement shall be governed by the laws of India. All disputes shall be subject to the exclusive jurisdiction of courts in <strong>Chennai, Tamil Nadu</strong>.</p>
    </div>

    <!-- Acknowledgement -->
    <div style="margin-bottom:28px;padding:14px 18px;background:#f8f7ff;border-radius:8px;border:1px solid #e0e7ff;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#4f46e5;">Acknowledgement</p>
      <p style="margin:0;">This SLA represents the complete understanding between <strong>${coName}</strong> and <strong>${sla.clientName}</strong>. Both parties acknowledge and agree to all terms, deliverables, and responsibilities outlined in this agreement.</p>
    </div>

    ${sla.notes ? `<div style="margin-bottom:28px;padding:14px 18px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;">Additional Notes</p><p style="margin:0;font-size:13px;color:#374151;">${sla.notes}</p></div>` : ""}

    <!-- Signatures are embedded below by the signing service (provider left, client right) -->
    <div style="height:150px;"></div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 44px;background:#f3f4f6;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${sla.slaNumber} &nbsp;|&nbsp; ${coName} &nbsp;|&nbsp; ${coEmail} &nbsp;|&nbsp; ${coPhone}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">This is a digitally generated Service Level Agreement.</p>
  </div>

</div>
</body>
</html>`;
};

const generateSLAPDF = async ({ sla, company }) => {
    const html = buildSLAHtml({ sla, company });

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdf = await page.pdf({
            format: "A4",
            margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
            printBackground: true,
        });
        return pdf;
    } finally {
        await browser.close();
    }
};

// Render a .docx template (with SLA data merged) to an HTML body fragment.
const renderTemplateToHtmlBody = async ({ sla, company, templatePath, clientOverrides }) => {
    const PizZip = require("pizzip");
    const Docxtemplater = require("docxtemplater");
    const mammoth = require("mammoth");

    const co = company || {};
    const coName    = co.companyName || "Hexite Technologies Private Limited";
    const coAddress = co.address     || "No 98, Varadharajan Street Kaladipet";
    const coCity    = `${co.city || "Chennai"}, ${co.state || "Tamil Nadu"} - ${co.pincode || "600019"}`;
    const coPhone   = co.phone       || "+91 9994081905";
    const coEmail   = co.email       || "praveen@hexitetechnologies.com";

    const fmtDate = (d) =>
        d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";
    const fmtAmt = (n) =>
        `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0)}`;

    const services = Array.isArray(sla.services) ? sla.services : [];

    // GST breakdown (stored total is GST-inclusive) — exposed as template placeholders
    const gstRate    = (co && typeof co.defaultTaxRate === "number") ? co.defaultTaxRate : 18;
    const gstin      = (co && co.gstin) || "";
    const grandTotal = Number(sla.totalAmount) || 0;
    const baseAmount = gstRate > 0 ? grandTotal / (1 + gstRate / 100) : grandTotal;
    const gstAmount  = grandTotal - baseAmount;

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render({
        slaNumber:     sla.slaNumber,
        clientName:    clientOverrides ? clientOverrides.clientName    : sla.clientName,
        clientEmail:   clientOverrides ? clientOverrides.clientEmail   : sla.clientEmail,
        clientPhone:   clientOverrides ? clientOverrides.clientPhone   : (sla.clientPhone   || ""),
        clientAddress: clientOverrides ? clientOverrides.clientAddress : (sla.clientAddress || ""),
        effectiveDate: fmtDate(sla.effectiveDate),
        expiryDate:    fmtDate(sla.expiryDate),
        totalAmount:   fmtAmt(sla.totalAmount),
        advanceAmount: fmtAmt(sla.advanceAmount),
        balanceAmount: fmtAmt(sla.balanceAmount),
        subtotal:      fmtAmt(baseAmount),
        gstRate:       String(gstRate),
        halfGstRate:   String(gstRate / 2),
        gstAmount:     fmtAmt(gstAmount),
        cgst:          fmtAmt(gstAmount / 2),
        sgst:          fmtAmt(gstAmount / 2),
        gstin,
        notes:         sla.notes || "",
        coName,
        coAddress,
        coCity,
        coPhone,
        coEmail,
        services: services.map((s, i) => ({
            index:       String(i + 1),
            description: s.description || "",
            amount:      fmtAmt(parseFloat(s.amount) || 0),
        })),
    });

    const filledBuf = doc.getZip().generate({ type: "nodebuffer" });
    const { value: htmlBody } = await mammoth.convertToHtml({ buffer: filledBuf });
    return htmlBody;
};

// CSS shared by the template-rendered PDF and the template signing page.
const TEMPLATE_CONTENT_CSS = `
  h1 { font-size: 20px; font-weight: 800; color: #4f46e5; margin: 0 0 10px; }
  h2 { font-size: 14px; font-weight: 700; color: #4f46e5;
       border-bottom: 2px solid #e0e7ff; padding-bottom: 5px; margin: 22px 0 10px; }
  h3 { font-size: 13px; font-weight: 700; color: #374151; margin: 14px 0 6px; }
  p  { margin: 0 0 10px; }
  ul, ol { padding-left: 22px; margin: 0 0 10px; }
  li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f3f4f6; font-weight: 700; padding: 9px 12px;
       text-align: left; border: 1px solid #e5e7eb; color: #374151; font-size: 12px; }
  td { padding: 9px 12px; border: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  strong, b { font-weight: 700; }`;

// Returns the merged template content wrapped for embedding in the signing page.
const buildTemplateHtmlBody = async ({ sla, company, templatePath }) => {
    const htmlBody = await renderTemplateToHtmlBody({ sla, company, templatePath });
    return `<style>.tpl-doc{font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.75;color:#1a1a1a;}${TEMPLATE_CONTENT_CSS}</style><div class="tpl-doc">${htmlBody}</div>`;
};

// Like buildTemplateHtmlBody, but turns the client placeholders ({clientName},
// {clientEmail}, {clientPhone}, {clientAddress}) into editable inline inputs so
// the client fills their details IN PLACE within the document. Returns
// { html, found } where `found` flags which fields were present in the template.
const buildTemplateSigningBody = async ({ sla, company, templatePath }) => {
    const MARK = {
        name:    "«ZX_CLIENT_NAME»",
        email:   "«ZX_CLIENT_EMAIL»",
        phone:   "«ZX_CLIENT_PHONE»",
        address: "«ZX_CLIENT_ADDRESS»",
    };
    let html = await renderTemplateToHtmlBody({
        sla, company, templatePath,
        clientOverrides: { clientName: MARK.name, clientEmail: MARK.email, clientPhone: MARK.phone, clientAddress: MARK.address },
    });

    const found = {};
    const replaceSmart = (marker, id, type, placeholder) => {
        const parts = html.split(marker);
        if (parts.length === 1) { found[id] = false; return; }
        found[id] = true;
        const input  = `<input id="${id}" class="doc-input-inline" type="${type}" placeholder="${placeholder}" />`;
        const mirror = `<span data-mirror="${id}" class="doc-mirror"></span>`;
        let out = parts[0];
        for (let i = 1; i < parts.length; i++) {
            out += (i === 1 ? input : mirror) + parts[i];
        }
        html = out;
    };
    replaceSmart(MARK.name,    "clientCompany", "text",  "Company / Client Name");
    replaceSmart(MARK.email,   "clientEmail",   "email", "Email ID");
    replaceSmart(MARK.phone,   "clientPhone",   "tel",   "Phone Number");
    replaceSmart(MARK.address, "clientAddress", "text",  "Address");

    const styles = `<style>.tpl-doc{font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.75;color:#1a1a1a;}${TEMPLATE_CONTENT_CSS}
.doc-input-inline{display:inline-block;min-width:160px;border:none;border-bottom:1.5px solid #4f46e5;background:#eef2ff;border-radius:4px 4px 0 0;padding:2px 6px;font-size:13px;font-family:Arial,sans-serif;color:#1e293b;outline:none;}
.doc-input-inline:focus{background:#e0e7ff;}
.doc-mirror{font-weight:600;color:#1e293b;}</style>`;
    return { html: `${styles}<div class="tpl-doc">${html}</div>`, found };
};

const generateSLAPDFFromTemplate = async ({ sla, company, templatePath }) => {
    const htmlBody = await renderTemplateToHtmlBody({ sla, company, templatePath });

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.75;
         color: #1a1a1a; padding: 48px 56px; }
${TEMPLATE_CONTENT_CSS}
</style>
</head>
<body>${htmlBody}</body>
</html>`;

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        return await page.pdf({
            format: "A4",
            margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
            printBackground: true,
        });
    } finally {
        await browser.close();
    }
};

module.exports = { generateSLAPDF, buildSLAHtml, generateSLAPDFFromTemplate, buildTemplateHtmlBody, buildTemplateSigningBody };
