/**
 * Run once: node scripts/generateSampleTemplate.js
 * Creates uploads/sla-templates/ZENVOICE-SLA-Template.docx
 * with all {placeholders} ready to fill.
 */
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, BorderStyle, AlignmentType, HeadingLevel, ShadingType,
    VerticalAlign,
} = require("docx");
const fs = require("fs");
const path = require("path");

const outDir  = path.join(__dirname, "../uploads/sla-templates");
const outFile = path.join(outDir, "ZENVOICE-SLA-Template.docx");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const INDIGO  = "4F46E5";
const DARK    = "111827";
const GRAY    = "6B7280";
const LIGHT   = "F3F4F6";
const WHITE   = "FFFFFF";

const bold   = (text, color = DARK, size = 24) =>
    new TextRun({ text, bold: true, color, size });
const normal = (text, color = DARK, size = 22) =>
    new TextRun({ text, color, size });
const ph     = (text) =>
    new TextRun({ text: `{${text}}`, bold: true, color: INDIGO, size: 22 });

const divider = () =>
    new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E7FF" } },
        spacing: { after: 160 },
    });

const heading = (text) =>
    new Paragraph({
        children: [bold(text, INDIGO, 26)],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E7FF" } },
    });

const para = (...runs) =>
    new Paragraph({ children: runs, spacing: { after: 120 } });

const bullet = (text) =>
    new Paragraph({
        children: [normal("• " + text)],
        spacing: { after: 80 },
        indent: { left: 360 },
    });

const labelVal = (label, valRuns) =>
    new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [bold(label, GRAY, 20)] })],
                        width: { size: 35, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.SOLID, color: "FAFAFA" },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: valRuns })],
                        width: { size: 65, type: WidthType.PERCENTAGE },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    }),
                ],
            }),
        ],
    });

const doc = new Document({
    sections: [{
        properties: {
            page: {
                margin: { top: 900, bottom: 900, left: 900, right: 900 },
            },
        },
        children: [

            // ── Title ──────────────────────────────────────────────────────────
            new Paragraph({
                children: [bold("SERVICE LEVEL AGREEMENT", WHITE, 32)],
                alignment: AlignmentType.CENTER,
                shading: { type: ShadingType.SOLID, color: INDIGO },
                spacing: { before: 0, after: 0 },
                border: { bottom: { style: BorderStyle.NONE } },
            }),
            new Paragraph({
                children: [bold("ZENVOICE PLATFORM", WHITE, 28)],
                alignment: AlignmentType.CENTER,
                shading: { type: ShadingType.SOLID, color: INDIGO },
                spacing: { after: 0 },
            }),
            new Paragraph({
                children: [normal("Powered by ZENXAI  |  {coName}", WHITE, 20)],
                alignment: AlignmentType.CENTER,
                shading: { type: ShadingType.SOLID, color: INDIGO },
                spacing: { after: 240 },
            }),

            // ── Ref line ──────────────────────────────────────────────────────
            new Paragraph({
                children: [
                    bold("Ref: "), ph("slaNumber"),
                    bold("   |   Effective: "), ph("effectiveDate"),
                    bold("   |   Term: "), normal("One (1) Year"),
                    bold("   |   Expires: "), ph("expiryDate"),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 280 },
            }),

            // ── Parties ───────────────────────────────────────────────────────
            heading("Parties to the Agreement"),
            para(bold("Service Provider:  "), ph("coName"), normal("  |  "), ph("coAddress"), normal(", "), ph("coCity")),
            para(bold("Phone: "), ph("coPhone"), normal("  |  Email: "), ph("coEmail")),
            para(bold("Client:  "), ph("clientName"), normal("  |  "), ph("clientAddress")),
            para(bold("Phone: "), ph("clientPhone"), normal("  |  Email: "), ph("clientEmail")),
            divider(),

            // ── Preamble ──────────────────────────────────────────────────────
            heading("Preamble"),
            para(
                normal('This Service Level Agreement ("Agreement") is made on '),
                ph("effectiveDate"),
                normal(', between '),
                ph("coName"),
                normal(' ("Service Provider") and '),
                ph("clientName"),
                normal(' ("Client"). Together referred to as the "Parties."'),
            ),
            divider(),

            // ── Purpose ───────────────────────────────────────────────────────
            heading("Purpose"),
            para(
                normal("This SLA defines the understanding between "), ph("coName"),
                normal(" and "), ph("clientName"),
                normal(" for the deployment and maintenance of the ZENVOICE platform powered by ZENXAI.")
            ),
            divider(),

            // ── Scope ─────────────────────────────────────────────────────────
            heading("Scope of Services"),
            para(normal("HEXITE shall deliver a complete, single-phase deployment including:")),
            bullet("End-to-end deployment of the ZENVOICE platform"),
            bullet("Setup of telephony automation using Telecmi"),
            bullet("AI-driven conversational workflows using ZENXAI"),
            bullet("Analytics and performance dashboards"),
            bullet("Integration with CRM, payment gateways, and relevant APIs"),
            bullet("Branding and white-label customization"),
            bullet("System training and onboarding for the Client's team"),
            bullet("Documentation and usage guidelines"),
            bullet("Ongoing platform maintenance and optimization during the SLA term"),
            divider(),

            // ── Contracted Services table ─────────────────────────────────────
            heading("Contracted Services — {slaNumber}"),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ children: [bold("#", GRAY, 20)] })],
                                width: { size: 8, type: WidthType.PERCENTAGE },
                                shading: { type: ShadingType.SOLID, color: LIGHT },
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [bold("Service / Description", GRAY, 20)] })],
                                width: { size: 68, type: WidthType.PERCENTAGE },
                                shading: { type: ShadingType.SOLID, color: LIGHT },
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [bold("Value", GRAY, 20)], alignment: AlignmentType.RIGHT })],
                                width: { size: 24, type: WidthType.PERCENTAGE },
                                shading: { type: ShadingType.SOLID, color: LIGHT },
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            }),
                        ],
                    }),
                    // Loop row — docxtemplater will repeat this for each service
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ children: [ph("services.index")] })],
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [ph("services.description")] })],
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [ph("services.amount")], alignment: AlignmentType.RIGHT })],
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            }),
                        ],
                    }),
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ children: [bold("Total Contract Value (Incl. GST)", WHITE)], alignment: AlignmentType.RIGHT })],
                                columnSpan: 2,
                                shading: { type: ShadingType.SOLID, color: INDIGO },
                                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [bold("{totalAmount}", WHITE, 26)], alignment: AlignmentType.RIGHT })],
                                shading: { type: ShadingType.SOLID, color: INDIGO },
                                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                            }),
                        ],
                    }),
                ],
            }),
            new Paragraph({ spacing: { after: 160 } }),
            divider(),

            // ── Commercial Terms ──────────────────────────────────────────────
            heading("Commercial Terms"),
            labelVal("Total Project Cost (Incl. GST)", [ph("totalAmount")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("Advance Payment (50%)", [ph("advanceAmount"), normal(" — payable before project commencement")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("Balance Payment (50%)", [ph("balanceAmount"), normal(" — payable after two weeks of commencement")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("Wallet Credit Benefit", [normal("50,000 credits added as fueling charges")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("Call Fueling Charges", [normal("INR 3.85 + applicable GST per minute")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("AWS Hosting Support", [normal("Up to $1,000 in AWS credits for infrastructure setup")]),
            new Paragraph({ spacing: { after: 160 } }),
            para(
                bold("Second Year Fee Waiver: "),
                normal("The platform fee for the second year shall be fully waived if the Client generates revenue of INR 5,00,000 to INR 10,00,000 within the first 12 months.")
            ),
            divider(),

            // ── Platform & Tech ───────────────────────────────────────────────
            heading("Platform & Technology"),
            labelVal("Telephony",       [normal("Telecmi Cloud Telephony")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("AI & Automation", [normal("ZENXAI Platform")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("Hosting",         [normal("AWS Cloud Infrastructure")]),
            new Paragraph({ spacing: { after: 60 } }),
            labelVal("Dashboard",       [normal("Custom-built ZENXAI-powered analytics interface")]),
            new Paragraph({ spacing: { after: 160 } }),
            divider(),

            // ── Confidentiality ───────────────────────────────────────────────
            heading("Confidentiality & NDA"),
            bullet("Both parties agree to maintain strict confidentiality of all shared information"),
            bullet("This obligation remains valid for three (3) years post termination"),
            bullet("Any breach may result in termination and legal action"),
            divider(),

            // ── IP ────────────────────────────────────────────────────────────
            heading("Intellectual Property & License"),
            bullet("All platforms, frameworks, AI systems, and code remain the intellectual property of HEXITE"),
            bullet("The Client is granted a non-exclusive, non-transferable license for usage during the agreement period"),
            divider(),

            // ── Termination ───────────────────────────────────────────────────
            heading("Termination Clause"),
            bullet("Either party may terminate this agreement with a 30-day written notice"),
            bullet("All outstanding payments must be cleared prior to termination"),
            bullet("Upon termination, access to the platform will be revoked"),
            divider(),

            // ── Governing Law ─────────────────────────────────────────────────
            heading("Governing Law & Jurisdiction"),
            para(normal("This Agreement shall be governed by the laws of India. All disputes shall be subject to the exclusive jurisdiction of courts in Chennai, Tamil Nadu.")),
            divider(),

            // ── Notes ─────────────────────────────────────────────────────────
            heading("Additional Notes"),
            para(ph("notes")),
            divider(),

            // ── Signatures ────────────────────────────────────────────────────
            heading("Acknowledgement & Signatures"),
            para(
                normal("This SLA represents the complete understanding between "),
                ph("coName"), normal(" and "), ph("clientName"),
                normal(". Both parties acknowledge and agree to all terms outlined in this agreement."),
            ),
            new Paragraph({ spacing: { after: 320 } }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({ children: [bold("For {coName}", GRAY, 20)] }),
                                    new Paragraph({ spacing: { after: 600 } }),
                                    new Paragraph({ children: [normal("Signature: _______________________")] }),
                                    new Paragraph({ children: [normal("Designation: Chief Business Officer")] }),
                                ],
                                margins: { top: 120, bottom: 120, left: 180, right: 180 },
                            }),
                            new TableCell({
                                children: [
                                    new Paragraph({ children: [bold("For {clientName}", GRAY, 20)] }),
                                    new Paragraph({ spacing: { after: 600 } }),
                                    new Paragraph({ children: [normal("Signature: _______________________")] }),
                                    new Paragraph({ children: [normal("Designation: Authorised Signatory")] }),
                                ],
                                margins: { top: 120, bottom: 120, left: 180, right: 180 },
                            }),
                        ],
                    }),
                ],
            }),

            // ── Footer ────────────────────────────────────────────────────────
            new Paragraph({ spacing: { after: 240 } }),
            new Paragraph({
                children: [normal("{slaNumber}  |  {coName}  |  {coEmail}  |  {coPhone}", GRAY, 18)],
                alignment: AlignmentType.CENTER,
                shading: { type: ShadingType.SOLID, color: LIGHT },
                spacing: { before: 120, after: 60 },
            }),
            new Paragraph({
                children: [normal("This is a digitally generated Service Level Agreement.", GRAY, 16)],
                alignment: AlignmentType.CENTER,
                shading: { type: ShadingType.SOLID, color: LIGHT },
            }),
        ],
    }],
});

Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync(outFile, buf);
    console.log("✅  Template saved to:", outFile);
}).catch((e) => {
    console.error("❌  Error:", e.message);
});
