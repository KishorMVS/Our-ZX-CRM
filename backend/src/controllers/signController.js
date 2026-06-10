const path = require("path");
const fs   = require("fs");
const prisma                   = require("../utils/prisma");
const { generateSLAPDF, generateSLAPDFFromTemplate, buildTemplateHtmlBody, buildTemplateSigningBody } = require("../services/pdfService");
const { embedSignaturesInPdf } = require("../services/signatureService");
const { sendSignedSLAEmail }   = require("../services/emailService");

const SIGNED_DIR = path.join(__dirname, "../../uploads/signed-slas");
if (!fs.existsSync(SIGNED_DIR)) fs.mkdirSync(SIGNED_DIR, { recursive: true });

// ── Shared signing-page CSS (used by both built-in and template signing pages) ──
const SIGN_STYLES = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#d1d5db;color:#111827;}
.top-bar{position:sticky;top:0;z-index:100;background:#4f46e5;color:#fff;
         padding:10px 20px;display:flex;align-items:center;justify-content:space-between;
         box-shadow:0 2px 12px rgba(0,0,0,.25);}
.top-bar .title{font-size:15px;font-weight:800;}
.top-bar .sub{font-size:11px;opacity:.75;margin-top:1px;}
.progress-track{height:3px;background:rgba(255,255,255,.2);}
.progress-fill{height:3px;background:#6ee7f7;width:0%;transition:width .3s;}
.page-wrap{max-width:900px;margin:24px auto 60px;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.18);}
h2.doc-h2{font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;
           letter-spacing:.5px;border-bottom:2px solid #e0e7ff;padding-bottom:6px;margin-bottom:10px;}
p.doc-p{font-size:13px;color:#374151;line-height:1.75;margin-bottom:10px;}
ul.doc-ul{margin:0 0 10px;padding-left:20px;font-size:13px;color:#374151;line-height:2;}
.doc-input{display:block;width:100%;border:none;border-bottom:1.5px solid #6366f1;
           background:#eef2ff;border-radius:4px 4px 0 0;padding:5px 8px;
           font-size:13px;color:#1e293b;font-family:Arial,sans-serif;
           outline:none;transition:.15s;margin-bottom:6px;}
.doc-input:focus{background:#e0e7ff;border-bottom-color:#4f46e5;}
.doc-input::placeholder{color:#a5b4fc;font-style:italic;}
.field-label{font-size:10px;font-weight:700;text-transform:uppercase;
             letter-spacing:.07em;color:#94a3b8;margin-bottom:2px;display:block;}
.canvas-wrap{border:1.5px dashed #818cf8;border-radius:6px;background:#f5f3ff;
             position:relative;cursor:crosshair;touch-action:none;margin:8px 0 6px;}
canvas{display:block;width:100%;height:110px;border-radius:4px;}
.canvas-hint{position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;pointer-events:none;transition:opacity .2s;}
.canvas-hint span{color:#a5b4fc;font-size:12px;}
.btn-clear{padding:3px 12px;border:1px solid #c7d2fe;border-radius:6px;font-size:11px;
           font-weight:600;cursor:pointer;background:#fff;color:#6366f1;transition:.15s;}
.btn-clear:hover{background:#eef2ff;}
.sig-tabs{display:flex;border:1.5px solid #c7d2fe;border-radius:8px;overflow:hidden;margin:8px 0;}
.sig-tab{flex:1;padding:5px 0;font-size:11px;font-weight:700;cursor:pointer;border:none;
         background:#fff;color:#94a3b8;transition:.15s;text-align:center;}
.sig-tab.active{background:#eef2ff;color:#4f46e5;}
.sig-tab:not(:last-child){border-right:1.5px solid #c7d2fe;}
.upload-drop{border:1.5px dashed #818cf8;border-radius:6px;background:#f5f3ff;
             min-height:80px;display:flex;flex-direction:column;align-items:center;
             justify-content:center;cursor:pointer;padding:8px;margin-bottom:6px;}
.upload-drop:hover{background:#eef2ff;}
.upload-preview{max-height:70px;max-width:100%;object-fit:contain;display:block;}
.submit-area{background:#f8f7ff;border-top:2px solid #e0e7ff;padding:24px 44px;}
.legal-text{background:#fff;border:1px solid #e0e7ff;border-radius:8px;
            padding:12px 16px;font-size:12px;color:#6b7280;line-height:1.7;margin-bottom:16px;}
.legal-text strong{color:#374151;}
.err-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
         padding:10px 14px;font-size:13px;color:#dc2626;margin-bottom:14px;display:none;}
.btn-sign{width:100%;padding:15px;background:#4f46e5;color:#fff;border:none;border-radius:10px;
          font-size:16px;font-weight:800;cursor:pointer;transition:background .15s;
          display:flex;align-items:center;justify-content:center;gap:10px;}
.btn-sign:hover{background:#4338ca;}
.btn-sign:disabled{opacity:.5;cursor:not-allowed;}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;
         align-items:center;justify-content:center;padding:20px;}
.overlay.active{display:flex;}
.ov-card{background:#fff;border-radius:16px;padding:40px;max-width:440px;
         text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.2);}
.ov-icon{font-size:56px;margin-bottom:16px;}
.ov-title{font-size:22px;font-weight:800;color:#059669;margin-bottom:10px;}
.ov-p{font-size:14px;color:#6b7280;line-height:1.7;max-width:340px;margin:0 auto;}
.sig-slot{border:2px solid #4f46e5;border-radius:8px;padding:16px;background:#fafaff;}
@media(max-width:640px){
  .top-bar{flex-direction:column;align-items:flex-start;gap:4px;}
  .page-wrap{margin:0;box-shadow:none;}
  .submit-area{padding:20px 16px;}
}`;

// ── Shared signing-page <script> (slots, draw/upload, submit) ──────────────────
function buildSignScript(slaNumber, maxSigs) {
    return `<script>
const MAX_SIGS = ${maxSigs};
const slots    = [];
let   nextIdx  = 0;

function initCanvas(i) {
    const canvas = document.getElementById("sigCanvas-" + i);
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    // Size the drawing buffer to the canvas's OWN displayed size so the cursor
    // maps 1:1 to the stroke. Using the wrapper width includes its border and
    // shifts the drawing away from where the mouse actually is.
    const dispW = canvas.offsetWidth  || 300;
    const dispH = canvas.offsetHeight || 110;
    canvas.width  = dispW * ratio;
    canvas.height = dispH * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    if (slots[i] && slots[i].pad) slots[i].pad.clear();
}
function activeSlots() { return slots.filter(s => s && s.active); }

function slotMarkup(i) {
    return '<div class="sig-slot-wrap" id="slotWrap-' + i + '" style="border:2px solid #4f46e5;border-radius:8px;padding:16px;background:#fafaff;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;">' +
          '<p class="slot-label" style="margin:0;font-size:10px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:1.2px;">Authorized Signatory</p>' +
          '<button type="button" class="btn-remove-slot" style="display:none;border:none;background:none;color:#ef4444;font-size:11px;font-weight:700;cursor:pointer;">Remove</button>' +
        '</div>' +
        '<span class="field-label">Full Name *</span>' +
        '<input id="signerName-' + i + '" class="doc-input" type="text" placeholder="Full name of signatory" autocomplete="name" />' +
        '<span class="field-label">Designation / Title</span>' +
        '<input id="signerDesignation-' + i + '" class="doc-input" type="text" placeholder="e.g. Managing Director" autocomplete="organization-title" />' +
        '<div class="sig-tabs" style="margin:10px 0 8px;">' +
          '<button id="tabDraw-' + i + '" class="sig-tab active tab-draw" type="button">Draw</button>' +
          '<button id="tabUpload-' + i + '" class="sig-tab tab-upload" type="button">Upload</button>' +
        '</div>' +
        '<div id="panelDraw-' + i + '">' +
          '<div class="canvas-wrap" id="canvasWrap-' + i + '"><canvas id="sigCanvas-' + i + '"></canvas>' +
          '<div class="canvas-hint" id="hint-' + i + '"><span>Sign here with mouse or finger</span></div></div>' +
          '<button class="btn-clear btn-clear-draw" type="button" style="margin-top:6px;">Clear</button>' +
        '</div>' +
        '<div id="panelUpload-' + i + '" style="display:none;">' +
          '<div class="upload-drop">' +
            '<input type="file" id="sigFile-' + i + '" accept="image/png,image/jpeg,image/jpg,image/webp" style="display:none;" />' +
            '<img id="uploadPreview-' + i + '" class="upload-preview" style="display:none;" />' +
            '<div id="uploadHint-' + i + '" style="text-align:center;"><p style="font-size:12px;color:#a5b4fc;margin:0;">Click to upload signature image</p>' +
            '<p style="font-size:11px;color:#c4b5fd;margin:4px 0 0;">PNG, JPG, JPEG, WebP</p></div>' +
          '</div>' +
          '<button class="btn-clear btn-clear-upload" type="button" style="margin-top:6px;">Clear</button>' +
        '</div>' +
      '</div>';
}

function addSlot() {
    if (activeSlots().length >= MAX_SIGS) return;
    const i = nextIdx++;
    document.getElementById("slotsContainer").insertAdjacentHTML("beforeend", slotMarkup(i));
    const wrap = document.getElementById("slotWrap-" + i);
    const pad = new SignaturePad(document.getElementById("sigCanvas-" + i), {
        backgroundColor : "rgba(250,250,255,0)", penColor : "#1e293b", minWidth : 1.5, maxWidth : 3,
    });
    slots[i] = { pad, mode: "draw", url: null, active: true };
    pad.addEventListener("beginStroke", () => { document.getElementById("hint-" + i).style.opacity = "0"; });
    wrap.querySelector(".tab-draw").onclick         = () => setSlotMode(i, "draw");
    wrap.querySelector(".tab-upload").onclick       = () => setSlotMode(i, "upload");
    wrap.querySelector(".btn-clear-draw").onclick   = () => clearSlot(i);
    wrap.querySelector(".btn-clear-upload").onclick = () => clearSlotUpload(i);
    wrap.querySelector(".btn-remove-slot").onclick  = () => removeSlot(i);
    wrap.querySelector(".upload-drop").onclick      = () => document.getElementById("sigFile-" + i).click();
    document.getElementById("sigFile-" + i).onchange = (e) => handleSlotFile(i, e);
    initCanvas(i); relabelSlots(); updateAddBtn();
}
function removeSlot(i) {
    if (!slots[i] || !slots[i].active) return;
    if (activeSlots().length <= 1) return;
    slots[i].active = false;
    const wrap = document.getElementById("slotWrap-" + i);
    if (wrap) wrap.remove();
    relabelSlots(); updateAddBtn();
}
function relabelSlots() {
    const active = activeSlots();
    document.querySelectorAll("#slotsContainer .sig-slot-wrap").forEach((wrap, n) => {
        const label = wrap.querySelector(".slot-label");
        const rm    = wrap.querySelector(".btn-remove-slot");
        if (label) label.textContent = (active.length > 1 ? "Signatory " + (n + 1) : "Authorized Signatory");
        if (rm)    rm.style.display = active.length > 1 ? "" : "none";
    });
}
function updateAddBtn() {
    const btn = document.getElementById("addSlotBtn");
    if (btn) btn.style.display = activeSlots().length >= MAX_SIGS ? "none" : "";
}
window.addEventListener("resize", () => { slots.forEach((s, i) => { if (s && s.active) initCanvas(i); }); });
addSlot();

// Keep any repeated inline placeholders in sync with their input as the client types.
["clientCompany", "clientAddress", "clientPhone", "clientEmail"].forEach(function (id) {
    const input = document.getElementById(id);
    if (!input) return;
    const sync = () => document.querySelectorAll('[data-mirror="' + id + '"]').forEach((el) => { el.textContent = input.value; });
    input.addEventListener("input", sync);
});

function setSlotMode(i, mode) {
    slots[i].mode = mode;
    document.getElementById("panelDraw-"   + i).style.display = mode === "draw"   ? "" : "none";
    document.getElementById("panelUpload-" + i).style.display = mode === "upload" ? "" : "none";
    const td = document.getElementById("tabDraw-" + i);   if (td) td.classList.toggle("active", mode === "draw");
    const tu = document.getElementById("tabUpload-" + i); if (tu) tu.classList.toggle("active", mode === "upload");
}
function handleSlotFile(i, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const image = new Image();
        image.onload = () => {
            const MAX = 600;
            let w = image.naturalWidth  || 600;
            let h = image.naturalHeight || 200;
            if (Math.max(w, h) > MAX) { const scale = MAX / Math.max(w, h); w = Math.round(w*scale); h = Math.round(h*scale); }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(image, 0, 0, w, h);
            let pngUrl;
            try { pngUrl = canvas.toDataURL("image/png"); } catch (err) { pngUrl = ev.target.result; }
            slots[i].url = pngUrl;
            const img = document.getElementById("uploadPreview-" + i);
            img.src = pngUrl; img.style.display = "block";
            document.getElementById("uploadHint-" + i).style.display = "none";
        };
        image.onerror = () => {
            slots[i].url = ev.target.result;
            const img = document.getElementById("uploadPreview-" + i);
            img.src = slots[i].url; img.style.display = "block";
            document.getElementById("uploadHint-" + i).style.display = "none";
        };
        image.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}
function clearSlotUpload(i) {
    slots[i].url = null;
    document.getElementById("sigFile-" + i).value = "";
    document.getElementById("uploadPreview-" + i).style.display = "none";
    document.getElementById("uploadHint-" + i).style.display = "";
}
function clearSlot(i) {
    slots[i].pad.clear();
    document.getElementById("hint-" + i).style.opacity = "1";
}
function liveUpdate() {
    const inp = document.getElementById("clientCompany");
    const out = document.getElementById("clientNameInline");
    if (inp && out) out.textContent = inp.value.trim() || "the Client";
}

async function submitAll() {
    const errEl = document.getElementById("errMsg");
    const btn   = document.getElementById("submitBtn");
    errEl.style.display = "none";
    const clientCompany = document.getElementById("clientCompany").value.trim();
    const clientAddress = document.getElementById("clientAddress").value.trim();
    const clientPhone   = document.getElementById("clientPhone").value.trim();
    const clientEmail   = document.getElementById("clientEmail").value.trim();
    if (!clientCompany) {
        errEl.textContent = "Please enter the Company / Client Name.";
        errEl.style.display = "block";
        document.getElementById("clientCompany").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (!clientEmail) {
        errEl.textContent = "Please enter the Email ID.";
        errEl.style.display = "block";
        document.getElementById("clientEmail").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        errEl.textContent = "Please enter a valid Email ID (e.g. name@company.com).";
        errEl.style.display = "block";
        document.getElementById("clientEmail").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (clientPhone && !/^[+]?[0-9\s().-]{7,20}$/.test(clientPhone)) {
        errEl.textContent = "Please enter a valid phone number, or leave it blank.";
        errEl.style.display = "block";
        const pn = document.getElementById("clientPhone");
        if (pn) pn.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    const sigs   = [];
    const active = slots.map((s, i) => ({ s, i })).filter((x) => x.s && x.s.active);
    for (let n = 0; n < active.length; n++) {
        const i    = active[n].i;
        const slot = active[n].s;
        const name = document.getElementById("signerName-" + i).value.trim();
        if (!name) {
            errEl.textContent = "Please enter the full name for Signatory " + (n + 1) + ".";
            errEl.style.display = "block";
            document.getElementById("signerName-" + i).scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        const dataUrl = slot.mode === "draw" ? slot.pad.toDataURL("image/png") : slot.url;
        if (!dataUrl || (slot.mode === "draw" && slot.pad.isEmpty())) {
            errEl.textContent = "Please draw or upload a signature for Signatory " + (n + 1) + ".";
            errEl.style.display = "block";
            document.getElementById("canvasWrap-" + i).scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        sigs.push({
            signerName        : name,
            signerDesignation : document.getElementById("signerDesignation-" + i).value.trim(),
            signatureDataUrl  : dataUrl,
        });
    }
    btn.disabled = true; btn.textContent = "Submitting…";
    try {
        const resp = await fetch(window.location.pathname, {
            method  : "POST",
            headers : { "Content-Type": "application/json" },
            body    : JSON.stringify({
                clientInfo : { company: clientCompany, address: clientAddress, phone: clientPhone, email: clientEmail },
                signatures : sigs,
            }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || "Submission failed");
        const bytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: "application/pdf" });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement("a");
        a.href = url; a.download = data.fileName || "${slaNumber}_signed.pdf";
        document.body.appendChild(a); a.click();
        URL.revokeObjectURL(url);
        document.getElementById("successOverlay").classList.add("active");
    } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = "block";
        btn.disabled = false; btn.textContent = "I Agree & Sign All";
    }
}
</script>`;
}

async function resolveToken(token) {
    return prisma.sLA.findFirst({
        where  : { signingToken: token },
        include: {
            createdBy    : { select: { id: true, name: true, email: true, workspaceId: true } },
            SLASignature : { orderBy: { slot: "asc" } },
        },
    });
}

// Public signing pages are reached by token, so there's no req.user to scope on.
// Derive the company branding from the SLA owner's workspace instead of grabbing
// an arbitrary tenant's settings (multi-tenant isolation on the public flow).
async function companySettingsForSla(sla) {
    const workspaceId = sla?.createdBy?.workspaceId;
    if (workspaceId) {
        return prisma.companySettings.findFirst({ where: { workspaceId } });
    }
    // Legacy SLAs with no workspace fall back to the single/global settings row.
    return prisma.companySettings.findFirst();
}

function errorPage(res, title, body, status = 400) {
    return res.status(status).send(`<!DOCTYPE html><html><head>
        <title>${title}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:system-ui,sans-serif;display:flex;align-items:center;
                 justify-content:center;min-height:100vh;background:#f1f5f9;}
            .card{background:#fff;border-radius:16px;padding:40px;max-width:460px;text-align:center;
                  box-shadow:0 4px 24px rgba(0,0,0,.08);}
            h2{color:#dc2626;margin-bottom:10px;font-size:20px;}
            p{color:#6b7280;line-height:1.7;font-size:14px;}
        </style></head><body>
        <div class="card"><h2>⚠ ${title}</h2><p>${body}</p></div>
    </body></html>`);
}

// ── GET /sign/:token — full document with embedded form fields ────────────────
const getSigningPage = async (req, res) => {
    try {
        const sla = await resolveToken(req.params.token);
        if (!sla) return errorPage(res, "Invalid Link", "This signing link is not valid or has expired.");

        const collected = sla.SLASignature.length;
        const required  = sla.signaturesRequired || 1;
        const allSigned = sla.status === "SIGNED" || collected >= required;
        const token     = req.params.token;

        const fmt     = (n) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0);
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

        // ── Already fully signed: show summary + auto-download ───────────────
        if (allSigned) {
            const signerRows = sla.SLASignature.map((s) =>
                `<tr>
                  <td>${s.signerName}</td>
                  <td>—</td>
                  <td>${s.signerCompany || "—"}</td>
                  <td>${new Date(s.signedAt).toLocaleDateString("en-IN")}</td>
                </tr>`
            ).join("");
            return res.send(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Already Signed — ${sla.slaNumber}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;
     display:flex;align-items:center;justify-content:center;padding:16px;}
.card{background:#fff;border-radius:16px;padding:40px;max-width:600px;width:100%;
      text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08);}
.icon{font-size:56px;margin-bottom:16px;}
h2{font-size:22px;font-weight:800;color:#059669;margin-bottom:10px;}
p{color:#6b7280;font-size:14px;line-height:1.7;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;margin-bottom:28px;}
th{background:#f8fafc;padding:8px 12px;font-size:11px;font-weight:700;
   color:#94a3b8;text-transform:uppercase;border:1px solid #e2e8f0;}
td{padding:8px 12px;border:1px solid #e2e8f0;color:#1e293b;}
.btn{display:inline-flex;align-items:center;gap:8px;background:#4f46e5;color:#fff;
     border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;
     cursor:pointer;text-decoration:none;margin-top:4px;}
.btn:hover{background:#4338ca;}
.note{font-size:12px;color:#94a3b8;margin-top:12px;}
</style></head><body>
<div class="card">
  <div class="icon">🔏</div>
  <h2>This SLA has already been signed</h2>
  <p>${sla.slaNumber} was fully executed.<br>Your signed copy is downloading automatically.</p>
  <table>
    <thead><tr><th>Signer</th><th>Designation</th><th>Company</th><th>Date</th></tr></thead>
    <tbody>${signerRows}</tbody>
  </table>
  <a href="/sign/${token}/download" class="btn" download>⬇ Download Again</a>
  <p class="note">This document is legally binding.</p>
</div>
<script>setTimeout(()=>{ window.location.href="/sign/${token}/download"; },600);</script>
</body></html>`);
        }

        // ── Signing page: full document with embedded fields ─────────────────
        // Company details
        const company   = await companySettingsForSla(sla);
        const co        = company || {};
        const coName    = co.companyName || "Hexite Technologies Private Limited";
        const coAddress = co.address     || "No 98, Varadharajan Street Kaladipet";
        const coCity    = `${co.city || "Chennai"}, ${co.state || "Tamil Nadu"} - ${co.pincode || "600019"}`;
        const coPhone   = co.phone       || "+91 9994081905";
        const coEmail   = co.email       || "praveen@hexitetechnologies.com";

        const effectiveDate = fmtDate(sla.effectiveDate);
        const expiryDate    = fmtDate(sla.expiryDate);
        const fmtINR = (n) => `INR ${new Intl.NumberFormat("en-IN").format(n || 0)}`;
        const fmtINR2 = (n) => `INR ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
        const services = Array.isArray(sla.services) ? sla.services : [];

        // GST breakdown (stored total is GST-inclusive)
        const gstRate    = (co && typeof co.defaultTaxRate === "number") ? co.defaultTaxRate : 18;
        const gstin      = (co && co.gstin) || "";
        const grandTotal = Number(sla.totalAmount) || 0;
        const baseAmount = gstRate > 0 ? grandTotal / (1 + gstRate / 100) : grandTotal;
        const gstAmount  = grandTotal - baseAmount;
        const halfRate   = gstRate / 2;

        const serviceRows = services.map((s, i) => `
            <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${i + 1}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${s.description || ""}</td>
                <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;text-align:right;font-weight:600;">₹${Number(s.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>`).join("");

        const row2 = (label, val) =>
            `<tr><td style="padding:8px 14px;font-weight:600;color:#374151;font-size:13px;width:45%;border-bottom:1px solid #f3f4f6;background:#fafafa;">${label}</td><td style="padding:8px 14px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${val}</td></tr>`;

        // Signature slots are built client-side: 1 by default, the client may
        // add more (up to MAX_SIGS) only if additional signatories are needed.
        const MAX_SIGS = 4;

        // ── Template-mode signing page: render the chosen .docx, then a details
        //    form + signature pad below. Falls through to built-in on any error. ──
        if (sla.templateId) {
            const template = await prisma.sLATemplate.findUnique({ where: { id: sla.templateId } });
            if (template && fs.existsSync(template.filePath)) {
                let templateBody = "";
                let foundFields = {};
                try {
                    const r = await buildTemplateSigningBody({ sla, company, templatePath: template.filePath });
                    templateBody = r.html;
                    foundFields  = r.found || {};
                } catch (e) {
                    console.error("[sign page template]", e.message);
                }
                if (templateBody) {
                    // Any client fields the template did NOT contain inline get a small
                    // fallback form, so required details (company, email) are always captured.
                    const fb = [];
                    if (!foundFields.clientCompany) fb.push(`<span class="field-label">Company / Client Name <span style="color:#ef4444;">*</span></span><input id="clientCompany" class="doc-input" type="text" placeholder="e.g. Astrovel Pvt. Ltd." />`);
                    if (!foundFields.clientEmail)   fb.push(`<span class="field-label">Email ID <span style="color:#ef4444;">*</span></span><input id="clientEmail" class="doc-input" type="email" placeholder="contact@company.com" />`);
                    if (!foundFields.clientPhone)   fb.push(`<span class="field-label">Phone Number</span><input id="clientPhone" class="doc-input" type="tel" placeholder="+91 9876543210" />`);
                    if (!foundFields.clientAddress) fb.push(`<span class="field-label">Address</span><input id="clientAddress" class="doc-input" type="text" placeholder="Registered office address" />`);
                    const fallbackForm = fb.length
                        ? `<div style="padding:16px 18px;background:#f0fdf4;border-radius:8px;border:2px solid #4f46e5;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.2px;">Your Details — Fill In ✏️</p>
      ${fb.join("")}
    </div>`
                        : "";
                    const providerBox = co.providerSignature
                        ? `<img src="${co.providerSignature}" style="height:55px;max-width:100%;object-fit:contain;display:block;margin-bottom:8px;border-bottom:1px solid #d1d5db;padding-bottom:6px;" alt="Provider Signature" />`
                        : `<div style="height:46px;border-bottom:1.5px dashed #d1d5db;margin-bottom:8px;background:#fafafa;border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;"><span style="font-size:10px;color:#d1d5db;font-style:italic;">Awaiting provider signature</span></div>`;

                    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign SLA — ${sla.slaNumber}</title>
<script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
<style>${SIGN_STYLES}</style>
</head>
<body>

<div class="top-bar">
  <div>
    <div class="title">📄 ${sla.slaNumber} — Service Level Agreement</div>
    <div class="sub">Review the agreement, fill in your details, and sign below</div>
  </div>
  <div style="text-align:right;font-size:12px;opacity:.85;white-space:nowrap;">
    <div style="font-weight:700;">₹${fmt(sla.totalAmount)}</div>
    <div style="opacity:.7;">${effectiveDate} – ${expiryDate}</div>
  </div>
</div>
<div class="progress-track"><div class="progress-fill"></div></div>

<div class="page-wrap">

  <!-- Template document -->
  <div style="padding:36px 44px;">${templateBody}</div>

  <div style="padding:0 44px 28px;">
    <!-- Client details that weren't inline in the template -->
    ${fallbackForm}

    <!-- Signatures -->
    <div style="padding-top:22px;border-top:2px solid #e5e7eb;">
      <h2 class="doc-h2" style="margin-bottom:16px;">Signatures</h2>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
        <div style="flex:0 0 200px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
          <p style="margin:0 0 8px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">For ${coName}</p>
          ${providerBox}
          <p style="margin:0;font-size:11px;color:#374151;">Designation: <strong>Chief Business Officer</strong></p>
          <p style="margin:2px 0 0;font-size:11px;color:#374151;">Name: <strong>${coName.split(" ")[0]}</strong></p>
        </div>
        <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:14px;">
          <div id="slotsContainer" style="display:flex;flex-direction:column;gap:14px;"></div>
          <button type="button" id="addSlotBtn" onclick="addSlot()"
            style="align-self:flex-start;border:1.5px dashed #818cf8;background:#f5f3ff;color:#4f46e5;
                   border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;">
            ＋ Add another signatory
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:12px 40px;background:#f3f4f6;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:10px;color:#9ca3af;">${sla.slaNumber} &nbsp;|&nbsp; ${coName} &nbsp;|&nbsp; ${coEmail} &nbsp;|&nbsp; ${coPhone}</p>
  </div>

</div>

<!-- Submit area -->
<div class="submit-area">
  <div class="legal-text">
    <strong>Electronic Signature Agreement:</strong> By clicking "I Agree &amp; Sign All", you and all signatories confirm
    that the electronic signatures above are legally binding, equivalent to handwritten signatures, and that all parties
    have read and accept all terms in SLA <strong>${sla.slaNumber}</strong>.
    The <strong>fully signed PDF will download automatically</strong>.
  </div>
  <div class="err-msg" id="errMsg"></div>
  <button class="btn-sign" id="submitBtn" onclick="submitAll()">✅ &nbsp;I Agree &amp; Sign All</button>
</div>

<!-- Success overlay -->
<div class="overlay" id="successOverlay">
  <div class="ov-card">
    <div class="ov-icon">🎉</div>
    <div class="ov-title">Signed &amp; Downloaded!</div>
    <p class="ov-p">All signatures collected. Your signed SLA is downloading now.</p>
  </div>
</div>

${buildSignScript(sla.slaNumber, MAX_SIGS)}
</body>
</html>`);
                }
            }
        }

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign SLA — ${sla.slaNumber}</title>
<script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#d1d5db;color:#111827;}
.top-bar{position:sticky;top:0;z-index:100;background:#4f46e5;color:#fff;
         padding:10px 20px;display:flex;align-items:center;justify-content:space-between;
         box-shadow:0 2px 12px rgba(0,0,0,.25);}
.top-bar .title{font-size:15px;font-weight:800;}
.top-bar .sub{font-size:11px;opacity:.75;margin-top:1px;}
.progress-track{height:3px;background:rgba(255,255,255,.2);}
.progress-fill{height:3px;background:#6ee7f7;width:0%;transition:width .3s;}
.page-wrap{max-width:900px;margin:24px auto 60px;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.18);}
h2.doc-h2{font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;
           letter-spacing:.5px;border-bottom:2px solid #e0e7ff;padding-bottom:6px;margin-bottom:10px;}
p.doc-p{font-size:13px;color:#374151;line-height:1.75;margin-bottom:10px;}
ul.doc-ul{margin:0 0 10px;padding-left:20px;font-size:13px;color:#374151;line-height:2;}
.doc-input{display:block;width:100%;border:none;border-bottom:1.5px solid #6366f1;
           background:#eef2ff;border-radius:4px 4px 0 0;padding:5px 8px;
           font-size:13px;color:#1e293b;font-family:Arial,sans-serif;
           outline:none;transition:.15s;margin-bottom:6px;}
.doc-input:focus{background:#e0e7ff;border-bottom-color:#4f46e5;}
.doc-input::placeholder{color:#a5b4fc;font-style:italic;}
.field-label{font-size:10px;font-weight:700;text-transform:uppercase;
             letter-spacing:.07em;color:#94a3b8;margin-bottom:2px;display:block;}
.canvas-wrap{border:1.5px dashed #818cf8;border-radius:6px;background:#f5f3ff;
             position:relative;cursor:crosshair;touch-action:none;margin:8px 0 6px;}
canvas{display:block;width:100%;height:110px;border-radius:4px;}
.canvas-hint{position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;pointer-events:none;transition:opacity .2s;}
.canvas-hint span{color:#a5b4fc;font-size:12px;}
.btn-clear{padding:3px 12px;border:1px solid #c7d2fe;border-radius:6px;font-size:11px;
           font-weight:600;cursor:pointer;background:#fff;color:#6366f1;transition:.15s;}
.btn-clear:hover{background:#eef2ff;}
.sig-tabs{display:flex;border:1.5px solid #c7d2fe;border-radius:8px;overflow:hidden;margin:8px 0;}
.sig-tab{flex:1;padding:5px 0;font-size:11px;font-weight:700;cursor:pointer;border:none;
         background:#fff;color:#94a3b8;transition:.15s;text-align:center;}
.sig-tab.active{background:#eef2ff;color:#4f46e5;}
.sig-tab:not(:last-child){border-right:1.5px solid #c7d2fe;}
.upload-drop{border:1.5px dashed #818cf8;border-radius:6px;background:#f5f3ff;
             min-height:80px;display:flex;flex-direction:column;align-items:center;
             justify-content:center;cursor:pointer;padding:8px;margin-bottom:6px;}
.upload-drop:hover{background:#eef2ff;}
.upload-preview{max-height:70px;max-width:100%;object-fit:contain;display:block;}
.submit-area{background:#f8f7ff;border-top:2px solid #e0e7ff;padding:24px 44px;}
.legal-text{background:#fff;border:1px solid #e0e7ff;border-radius:8px;
            padding:12px 16px;font-size:12px;color:#6b7280;line-height:1.7;margin-bottom:16px;}
.legal-text strong{color:#374151;}
.err-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
         padding:10px 14px;font-size:13px;color:#dc2626;margin-bottom:14px;display:none;}
.btn-sign{width:100%;padding:15px;background:#4f46e5;color:#fff;border:none;border-radius:10px;
          font-size:16px;font-weight:800;cursor:pointer;transition:background .15s;
          display:flex;align-items:center;justify-content:center;gap:10px;}
.btn-sign:hover{background:#4338ca;}
.btn-sign:disabled{opacity:.5;cursor:not-allowed;}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;
         align-items:center;justify-content:center;padding:20px;}
.overlay.active{display:flex;}
.ov-card{background:#fff;border-radius:16px;padding:40px;max-width:440px;
         text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.2);}
.ov-icon{font-size:56px;margin-bottom:16px;}
.ov-title{font-size:22px;font-weight:800;color:#059669;margin-bottom:10px;}
.ov-p{font-size:14px;color:#6b7280;line-height:1.7;max-width:340px;margin:0 auto;}
.sig-slot{border:2px solid #4f46e5;border-radius:8px;padding:16px;background:#fafaff;}
@media(max-width:640px){
  .top-bar{flex-direction:column;align-items:flex-start;gap:4px;}
  .page-wrap{margin:0;box-shadow:none;}
  .submit-area{padding:20px 16px;}
}
</style>
</head>
<body>

<div class="top-bar">
  <div>
    <div class="title">📄 ${sla.slaNumber} — Service Level Agreement</div>
    <div class="sub">Sign below to execute this agreement — add more signatories only if required</div>
  </div>
  <div style="text-align:right;font-size:12px;opacity:.85;white-space:nowrap;">
    <div style="font-weight:700;">₹${fmt(sla.totalAmount)}</div>
    <div style="opacity:.7;">${effectiveDate} – ${expiryDate}</div>
  </div>
</div>
<div class="progress-track"><div class="progress-fill"></div></div>

<div class="page-wrap">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;color:#fff;">
    <div style="text-align:center;margin-bottom:14px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:3px;opacity:.75;margin-bottom:6px;">SERVICE LEVEL AGREEMENT</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:2px;">ZENVOICE PLATFORM</div>
      <div style="font-size:10px;opacity:.7;margin-top:3px;letter-spacing:1px;">Powered by ZENXAI &nbsp;|&nbsp; ${coName}</div>
    </div>
    <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:28px;padding-top:14px;
                border-top:1px solid rgba(255,255,255,.2);font-size:12px;opacity:.9;">
      <div><span style="opacity:.65;">Ref: </span><strong>${sla.slaNumber}</strong></div>
      <div><span style="opacity:.65;">Effective: </span><strong>${effectiveDate}</strong></div>
      <div><span style="opacity:.65;">Term: </span><strong>One (1) Year</strong></div>
      <div><span style="opacity:.65;">Expires: </span><strong>${expiryDate}</strong></div>
    </div>
  </div>

  <div style="padding:32px 40px;">

    <!-- PARTIES -->
    <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
      <!-- Service Provider -->
      <div style="flex:1;min-width:200px;padding:14px 16px;background:#f8f7ff;border-radius:8px;border:1px solid #e0e7ff;">
        <p style="margin:0 0 5px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;">Service Provider</p>
        <p style="margin:0 0 2px;font-weight:800;color:#111827;font-size:13px;">${coName}</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:11px;">${coAddress}, ${coCity}</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:11px;">${coPhone} &nbsp;|&nbsp; ${coEmail}</p>
        <p style="margin:4px 0 0;font-size:10px;color:#7c3aed;font-weight:600;">(hereinafter "Service Provider")</p>
      </div>
      <!-- Client Info -->
      <div style="flex:1;min-width:220px;padding:14px 16px;background:#f0fdf4;border-radius:8px;border:2px solid #4f46e5;">
        <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.2px;">Client — Fill In Details ✏️</p>
        <span class="field-label">Company / Client Name <span style="color:#ef4444;">*</span></span>
        <input id="clientCompany" class="doc-input" type="text" placeholder="e.g. Digi Smart Pvt. Ltd." oninput="liveUpdate()" />
        <span class="field-label">Address</span>
        <input id="clientAddress" class="doc-input" type="text" placeholder="Registered office address" />
        <span class="field-label">Phone Number</span>
        <input id="clientPhone" class="doc-input" type="tel" placeholder="+91 9876543210" />
        <span class="field-label">Email ID <span style="color:#ef4444;">*</span></span>
        <input id="clientEmail" class="doc-input" type="email" placeholder="contact@company.com" />
        <p style="margin:6px 0 0;font-size:10px;color:#059669;font-weight:600;">(hereinafter "Client")</p>
      </div>
    </div>

    <!-- Preamble -->
    <div style="margin-bottom:20px;padding:12px 16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;">
      <p class="doc-p" style="margin:0;font-size:13px;">
        This Agreement is entered into on <strong>${effectiveDate}</strong>, between <strong>${coName}</strong>
        ("Service Provider") and <strong><span id="clientNameInline">the Client</span></strong> ("Client").
        Both parties are collectively referred to as the "<strong>Parties</strong>."
      </p>
    </div>

    <!-- Purpose -->
    <div style="margin-bottom:18px;">
      <h2 class="doc-h2">Purpose</h2>
      <p class="doc-p">This SLA defines the understanding between <strong>${coName}</strong> and the Client for the deployment and maintenance of the <strong>ZENVOICE</strong> platform powered by <strong>ZENXAI</strong>.</p>
    </div>

    <!-- Scope -->
    <div style="margin-bottom:18px;">
      <h2 class="doc-h2">Scope of Services</h2>
      <ul class="doc-ul">
        <li>End-to-end deployment of the ZENVOICE platform</li>
        <li>Setup of telephony automation using Telecmi</li>
        <li>Implementation of AI-driven conversational workflows using ZENXAI</li>
        <li>Development of analytics and performance dashboards</li>
        <li>Integration with CRM systems, payment gateways, and APIs</li>
        <li>Branding and white-label customization</li>
        <li>System training and onboarding</li>
        <li>Ongoing platform maintenance and updates</li>
      </ul>
    </div>

    <!-- Services table -->
    <div style="margin-bottom:18px;">
      <h2 class="doc-h2">Contracted Services — ${sla.slaNumber}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;">#</th>
          <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;">Service / Description</th>
          <th style="padding:9px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:700;">Value</th>
        </tr></thead>
        <tbody>${serviceRows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;"><td colspan="2" style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#374151;">Subtotal (Taxable Value)</td><td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#374151;">${fmtINR2(baseAmount)}</td></tr>
          <tr style="background:#f9fafb;"><td colspan="2" style="padding:8px 12px;text-align:right;font-size:12px;color:#374151;">CGST @ ${halfRate}%</td><td style="padding:8px 12px;text-align:right;font-size:12px;color:#374151;">${fmtINR2(gstAmount / 2)}</td></tr>
          <tr style="background:#f9fafb;"><td colspan="2" style="padding:8px 12px;text-align:right;font-size:12px;color:#374151;">SGST @ ${halfRate}%</td><td style="padding:8px 12px;text-align:right;font-size:12px;color:#374151;">${fmtINR2(gstAmount / 2)}</td></tr>
          <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed);">
            <td colspan="2" style="padding:11px 12px;font-weight:700;color:#fff;font-size:13px;">Total Contract Value (Incl. GST @ ${gstRate}%)</td>
            <td style="padding:11px 12px;text-align:right;font-weight:800;color:#fff;font-size:14px;">${fmtINR2(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Commercial Terms -->
    <div style="margin-bottom:18px;">
      <h2 class="doc-h2">Commercial Terms</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        ${row2("Total Project Cost (Incl. GST)", `<strong>${fmtINR(sla.totalAmount)}</strong>`)}
        ${row2("Advance Payment (50%)", `<strong>${fmtINR(sla.advanceAmount)}</strong> — payable before project commencement`)}
        ${row2("Balance Payment (50%)", `<strong>${fmtINR(sla.balanceAmount)}</strong> — payable after two weeks of commencement`)}
        ${row2("Wallet Credit Benefit", "50,000 credits added as fueling charges")}
        ${row2("Call Fueling Charges", "INR 3.85 + applicable GST per minute")}
        ${row2("AWS Hosting Support", "Up to $1,000 in AWS credits")}
      </table>
    </div>

    <!-- Roles -->
    <div style="margin-bottom:18px;">
      <h2 class="doc-h2">Roles &amp; Responsibilities</h2>
      <p class="doc-p" style="font-weight:700;margin-bottom:4px;">HEXITE Responsibilities:</p>
      <ul class="doc-ul"><li>Complete platform setup, configuration, and deployment</li><li>Onboarding and training for system usage</li><li>Ongoing technical support and maintenance</li></ul>
      <p class="doc-p" style="font-weight:700;margin:8px 0 4px;">Client Responsibilities:</p>
      <ul class="doc-ul"><li>Managing AWS hosting infrastructure</li><li>Maintaining the Telecmi telephony account</li><li>Ensuring timely payments</li></ul>
    </div>

    <!-- Confidentiality & Governing Law -->
    <div style="margin-bottom:18px;">
      <h2 class="doc-h2">Confidentiality &amp; Termination</h2>
      <ul class="doc-ul">
        <li>Both parties maintain strict confidentiality for <strong>3 years</strong> post-termination</li>
        <li>Either party may terminate with a <strong>30-day written notice</strong></li>
        <li>All outstanding payments must be cleared prior to termination</li>
      </ul>
    </div>
    <div style="margin-bottom:24px;">
      <h2 class="doc-h2">Governing Law</h2>
      <p class="doc-p">This Agreement is governed by the laws of India. All disputes are subject to courts in <strong>Chennai, Tamil Nadu</strong>.</p>
    </div>

    ${sla.notes ? `<div style="margin-bottom:24px;padding:12px 16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;"><p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#92400e;">Additional Notes</p><p class="doc-p" style="margin:0;">${sla.notes}</p></div>` : ""}

    <!-- ── SIGNATURE SECTION ─────────────────────────────────────────────── -->
    <div style="margin-top:8px;padding-top:22px;border-top:2px solid #e5e7eb;">
      <h2 class="doc-h2" style="margin-bottom:16px;">Signatures</h2>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">

        <!-- Provider box -->
        <div style="flex:0 0 200px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
          <p style="margin:0 0 8px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">For ${coName}</p>
          ${co.providerSignature
            ? `<img src="${co.providerSignature}" style="height:55px;max-width:100%;object-fit:contain;display:block;margin-bottom:8px;border-bottom:1px solid #d1d5db;padding-bottom:6px;" alt="Provider Signature" />`
            : `<div style="height:46px;border-bottom:1.5px dashed #d1d5db;margin-bottom:8px;background:#fafafa;border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;"><span style="font-size:10px;color:#d1d5db;font-style:italic;">Awaiting provider signature</span></div>`}
          <p style="margin:0;font-size:11px;color:#374151;">Designation: <strong>Chief Business Officer</strong></p>
          <p style="margin:2px 0 0;font-size:11px;color:#374151;">Name: <strong>${coName.split(" ")[0]}</strong></p>
        </div>

        <!-- All signatory slots (built client-side; 1 by default, up to 4) -->
        <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:14px;">
          <div id="slotsContainer" style="display:flex;flex-direction:column;gap:14px;"></div>
          <button type="button" id="addSlotBtn" onclick="addSlot()"
            style="align-self:flex-start;border:1.5px dashed #818cf8;background:#f5f3ff;color:#4f46e5;
                   border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;">
            ＋ Add another signatory
          </button>
        </div>

      </div>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:12px 40px;background:#f3f4f6;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:10px;color:#9ca3af;">${sla.slaNumber} &nbsp;|&nbsp; ${coName} &nbsp;|&nbsp; ${coEmail} &nbsp;|&nbsp; ${coPhone}</p>
  </div>

</div>

<!-- Submit area -->
<div class="submit-area">
  <div class="legal-text">
    <strong>Electronic Signature Agreement:</strong> By clicking "I Agree &amp; Sign All", you and all signatories confirm
    that the electronic signatures above are legally binding, equivalent to handwritten signatures, and that all parties
    have read and accept all terms in SLA <strong>${sla.slaNumber}</strong>.
    The <strong>fully signed PDF will download automatically</strong>.
  </div>
  <div class="err-msg" id="errMsg"></div>
  <button class="btn-sign" id="submitBtn" onclick="submitAll()">✅ &nbsp;I Agree &amp; Sign All</button>
</div>

<!-- Success overlay -->
<div class="overlay" id="successOverlay">
  <div class="ov-card">
    <div class="ov-icon">🎉</div>
    <div class="ov-title">Signed &amp; Downloaded!</div>
    <p class="ov-p">All signatures collected. Your signed SLA is downloading now.</p>
  </div>
</div>

<script>
const MAX_SIGS = ${MAX_SIGS};
const slots    = [];   // index-stable; removed entries have active=false
let   nextIdx  = 0;

// ── Canvas sizing ─────────────────────────────────────────────────────────────
function initCanvas(i) {
    const canvas = document.getElementById("sigCanvas-" + i);
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    // Size the drawing buffer to the canvas's OWN displayed size so the cursor
    // maps 1:1 to the stroke. Using the wrapper width includes its border and
    // shifts the drawing away from where the mouse actually is.
    const dispW = canvas.offsetWidth  || 300;
    const dispH = canvas.offsetHeight || 110;
    canvas.width  = dispW * ratio;
    canvas.height = dispH * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    if (slots[i] && slots[i].pad) slots[i].pad.clear();
}

function activeSlots() { return slots.filter(s => s && s.active); }

// ── Build one signatory slot's markup (no inline handlers — wired in addSlot) ──
function slotMarkup(i) {
    return '<div class="sig-slot-wrap" id="slotWrap-' + i + '" style="border:2px solid #4f46e5;border-radius:8px;padding:16px;background:#fafaff;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;">' +
          '<p class="slot-label" style="margin:0;font-size:10px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:1.2px;">Authorized Signatory ✏️</p>' +
          '<button type="button" class="btn-remove-slot" style="display:none;border:none;background:none;color:#ef4444;font-size:11px;font-weight:700;cursor:pointer;">✕ Remove</button>' +
        '</div>' +
        '<span class="field-label">Full Name <span style="color:#ef4444;">*</span></span>' +
        '<input id="signerName-' + i + '" class="doc-input" type="text" placeholder="Full name of signatory" autocomplete="name" />' +
        '<span class="field-label">Designation / Title</span>' +
        '<input id="signerDesignation-' + i + '" class="doc-input" type="text" placeholder="e.g. Managing Director" autocomplete="organization-title" />' +
        '<div class="sig-tabs" style="margin:10px 0 8px;">' +
          '<button id="tabDraw-' + i + '" class="sig-tab active tab-draw" type="button">✍️ Draw</button>' +
          '<button id="tabUpload-' + i + '" class="sig-tab tab-upload" type="button">📷 Upload</button>' +
        '</div>' +
        '<div id="panelDraw-' + i + '">' +
          '<div class="canvas-wrap" id="canvasWrap-' + i + '"><canvas id="sigCanvas-' + i + '"></canvas>' +
          '<div class="canvas-hint" id="hint-' + i + '"><span>Sign here with mouse or finger</span></div></div>' +
          '<button class="btn-clear btn-clear-draw" type="button" style="margin-top:6px;">Clear</button>' +
        '</div>' +
        '<div id="panelUpload-' + i + '" style="display:none;">' +
          '<div class="upload-drop">' +
            '<input type="file" id="sigFile-' + i + '" accept="image/png,image/jpeg,image/jpg,image/webp" style="display:none;" />' +
            '<img id="uploadPreview-' + i + '" class="upload-preview" style="display:none;" />' +
            '<div id="uploadHint-' + i + '" style="text-align:center;"><p style="font-size:12px;color:#a5b4fc;margin:0;">Click to upload signature image</p>' +
            '<p style="font-size:11px;color:#c4b5fd;margin:4px 0 0;">PNG, JPG, JPEG, WebP</p></div>' +
          '</div>' +
          '<button class="btn-clear btn-clear-upload" type="button" style="margin-top:6px;">Clear</button>' +
        '</div>' +
      '</div>';
}

// ── Add a signatory slot (up to MAX_SIGS) ─────────────────────────────────────
function addSlot() {
    if (activeSlots().length >= MAX_SIGS) return;
    const i = nextIdx++;
    document.getElementById("slotsContainer").insertAdjacentHTML("beforeend", slotMarkup(i));
    const wrap = document.getElementById("slotWrap-" + i);

    const pad = new SignaturePad(document.getElementById("sigCanvas-" + i), {
        backgroundColor : "rgba(250,250,255,0)",
        penColor        : "#1e293b",
        minWidth        : 1.5,
        maxWidth        : 3,
    });
    slots[i] = { pad, mode: "draw", url: null, active: true };
    pad.addEventListener("beginStroke", () => { document.getElementById("hint-" + i).style.opacity = "0"; });

    // Wire handlers
    wrap.querySelector(".tab-draw").onclick        = () => setSlotMode(i, "draw");
    wrap.querySelector(".tab-upload").onclick      = () => setSlotMode(i, "upload");
    wrap.querySelector(".btn-clear-draw").onclick  = () => clearSlot(i);
    wrap.querySelector(".btn-clear-upload").onclick= () => clearSlotUpload(i);
    wrap.querySelector(".btn-remove-slot").onclick = () => removeSlot(i);
    wrap.querySelector(".upload-drop").onclick     = () => document.getElementById("sigFile-" + i).click();
    document.getElementById("sigFile-" + i).onchange = (e) => handleSlotFile(i, e);

    initCanvas(i);
    relabelSlots();
    updateAddBtn();
}

function removeSlot(i) {
    if (!slots[i] || !slots[i].active) return;
    if (activeSlots().length <= 1) return;   // always keep at least one
    slots[i].active = false;
    const wrap = document.getElementById("slotWrap-" + i);
    if (wrap) wrap.remove();
    relabelSlots();
    updateAddBtn();
}

// Renumber visible labels and show "Remove" only when more than one slot exists
function relabelSlots() {
    const active = activeSlots();
    document.querySelectorAll("#slotsContainer .sig-slot-wrap").forEach((wrap, n) => {
        const label = wrap.querySelector(".slot-label");
        const rm    = wrap.querySelector(".btn-remove-slot");
        if (label) label.textContent = (active.length > 1 ? "Signatory " + (n + 1) : "Authorized Signatory") + " ✏️";
        if (rm)    rm.style.display = active.length > 1 ? "" : "none";
    });
}

function updateAddBtn() {
    const btn = document.getElementById("addSlotBtn");
    if (btn) btn.style.display = activeSlots().length >= MAX_SIGS ? "none" : "";
}

window.addEventListener("resize", () => { activeSlots().forEach((_, n) => {}); slots.forEach((s, i) => { if (s && s.active) initCanvas(i); }); });

// Start with a single signatory slot
addSlot();

// ── Slot helpers ──────────────────────────────────────────────────────────────
function setSlotMode(i, mode) {
    slots[i].mode = mode;
    document.getElementById("panelDraw-"   + i).style.display = mode === "draw"   ? "" : "none";
    document.getElementById("panelUpload-" + i).style.display = mode === "upload" ? "" : "none";
    document.getElementById("tabDraw-"     + i).classList.toggle("active", mode === "draw");
    document.getElementById("tabUpload-"   + i).classList.toggle("active", mode === "upload");
}
function handleSlotFile(i, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        // Normalize ANY uploaded image (JPG/JPEG/WebP/PNG) to PNG via canvas,
        // so the backend always receives an embeddable PNG data URL.
        const image = new Image();
        image.onload = () => {
            // Downscale large images so the base64 payload stays small (cap longest side at 600px)
            const MAX = 600;
            let w = image.naturalWidth  || 600;
            let h = image.naturalHeight || 200;
            if (Math.max(w, h) > MAX) {
                const scale = MAX / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            const canvas = document.createElement("canvas");
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(image, 0, 0, w, h);
            let pngUrl;
            try { pngUrl = canvas.toDataURL("image/png"); }
            catch (err) { pngUrl = ev.target.result; }
            slots[i].url = pngUrl;
            const img = document.getElementById("uploadPreview-" + i);
            img.src = pngUrl;
            img.style.display = "block";
            document.getElementById("uploadHint-" + i).style.display = "none";
        };
        image.onerror = () => {
            slots[i].url = ev.target.result;
            const img = document.getElementById("uploadPreview-" + i);
            img.src = slots[i].url;
            img.style.display = "block";
            document.getElementById("uploadHint-" + i).style.display = "none";
        };
        image.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}
function clearSlotUpload(i) {
    slots[i].url = null;
    document.getElementById("sigFile-" + i).value = "";
    document.getElementById("uploadPreview-" + i).style.display = "none";
    document.getElementById("uploadHint-" + i).style.display = "";
}
function clearSlot(i) {
    slots[i].pad.clear();
    document.getElementById("hint-" + i).style.opacity = "1";
}

// ── Live preamble update ──────────────────────────────────────────────────────
function liveUpdate() {
    const co = document.getElementById("clientCompany").value.trim();
    document.getElementById("clientNameInline").textContent = co || "the Client";
}

// ── Submit all signatures at once ─────────────────────────────────────────────
async function submitAll() {
    const errEl = document.getElementById("errMsg");
    const btn   = document.getElementById("submitBtn");
    errEl.style.display = "none";

    const clientCompany = document.getElementById("clientCompany").value.trim();
    const clientAddress = document.getElementById("clientAddress").value.trim();
    const clientPhone   = document.getElementById("clientPhone").value.trim();
    const clientEmail   = document.getElementById("clientEmail").value.trim();

    if (!clientCompany) {
        errEl.textContent = "Please enter the Company / Client Name.";
        errEl.style.display = "block";
        document.getElementById("clientCompany").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (!clientEmail) {
        errEl.textContent = "Please enter the Email ID.";
        errEl.style.display = "block";
        document.getElementById("clientEmail").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        errEl.textContent = "Please enter a valid Email ID (e.g. name@company.com).";
        errEl.style.display = "block";
        document.getElementById("clientEmail").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (clientPhone && !/^[+]?[0-9\s().-]{7,20}$/.test(clientPhone)) {
        errEl.textContent = "Please enter a valid phone number, or leave it blank.";
        errEl.style.display = "block";
        const pn = document.getElementById("clientPhone");
        if (pn) pn.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    const sigs   = [];
    const active = slots.map((s, i) => ({ s, i })).filter((x) => x.s && x.s.active);
    for (let n = 0; n < active.length; n++) {
        const i    = active[n].i;
        const slot = active[n].s;
        const name = document.getElementById("signerName-" + i).value.trim();
        if (!name) {
            errEl.textContent = "Please enter the full name for Signatory " + (n + 1) + ".";
            errEl.style.display = "block";
            document.getElementById("signerName-" + i).scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        const dataUrl = slot.mode === "draw" ? slot.pad.toDataURL("image/png") : slot.url;
        if (!dataUrl || (slot.mode === "draw" && slot.pad.isEmpty())) {
            errEl.textContent = "Please draw or upload a signature for Signatory " + (n + 1) + ".";
            errEl.style.display = "block";
            document.getElementById("canvasWrap-" + i).scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        sigs.push({
            signerName        : name,
            signerDesignation : document.getElementById("signerDesignation-" + i).value.trim(),
            signatureDataUrl  : dataUrl,
        });
    }

    btn.disabled    = true;
    btn.textContent = "Submitting…";

    try {
        const resp = await fetch(window.location.pathname, {
            method  : "POST",
            headers : { "Content-Type": "application/json" },
            body    : JSON.stringify({
                clientInfo : { company: clientCompany, address: clientAddress, phone: clientPhone, email: clientEmail },
                signatures : sigs,
            }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || "Submission failed");

        const bytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: "application/pdf" });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement("a");
        a.href = url; a.download = data.fileName || "${sla.slaNumber}_signed.pdf";
        document.body.appendChild(a); a.click();
        URL.revokeObjectURL(url);
        document.getElementById("successOverlay").classList.add("active");
    } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = "block";
        btn.disabled    = false;
        btn.textContent = "✅  I Agree & Sign All";
    }
}
</script>
</body>
</html>`);

    } catch (err) {
        console.error("[sign page]", err);
        errorPage(res, "Something Went Wrong", "Unable to load the signing page. Please try again.", 500);
    }
};

// ── GET /sign/:token/pdf — still available for direct PDF link ────────────────
const getSigningPdf = async (req, res) => {
    try {
        const sla = await resolveToken(req.params.token);
        if (!sla) return res.status(404).send("Not found");
        const company = await companySettingsForSla(sla);
        let pdfBuffer;
        if (sla.templateId) {
            const template = await prisma.sLATemplate.findUnique({ where: { id: sla.templateId } });
            if (template && fs.existsSync(template.filePath))
                pdfBuffer = await generateSLAPDFFromTemplate({ sla, company, templatePath: template.filePath });
        }
        if (!pdfBuffer) pdfBuffer = await generateSLAPDF({ sla, company });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${sla.slaNumber}.pdf"`);
        res.send(Buffer.from(pdfBuffer));
    } catch (err) {
        console.error("[sign pdf]", err);
        res.status(500).send("Error generating PDF");
    }
};

// ── GET /sign/:token/download — download already-signed PDF ──────────────────
const downloadSignedPdf = async (req, res) => {
    try {
        const sla = await resolveToken(req.params.token);
        if (!sla) return res.status(404).send("Not found");
        if (!sla.signedPdfPath || !fs.existsSync(sla.signedPdfPath))
            return res.status(404).send("Signed PDF not available");
        res.download(sla.signedPdfPath, `${sla.slaNumber}_signed.pdf`);
    } catch (err) {
        console.error("[sign download]", err);
        res.status(500).send("Error");
    }
};

// ── POST /sign/:token — receive all signatures at once ───────────────────────
const submitSignature = async (req, res) => {
    try {
        const { token } = req.params;
        const { clientInfo, signatures } = req.body;

        // Basic payload validation
        if (!clientInfo?.company?.trim())
            return res.status(400).json({ message: "Company / Client Name is required" });
        if (!clientInfo?.email?.trim())
            return res.status(400).json({ message: "Email ID is required" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email.trim()))
            return res.status(400).json({ message: "A valid Email ID is required" });
        if (clientInfo.phone?.trim() && !/^[+]?[0-9\s().-]{7,20}$/.test(clientInfo.phone.trim()))
            return res.status(400).json({ message: "A valid phone number is required (or leave it blank)" });
        if (!Array.isArray(signatures) || signatures.length === 0)
            return res.status(400).json({ message: "At least one signature is required" });

        for (let i = 0; i < signatures.length; i++) {
            if (!signatures[i].signerName?.trim())
                return res.status(400).json({ message: `Name is required for Signatory ${i + 1}` });
            if (!signatures[i].signatureDataUrl)
                return res.status(400).json({ message: `Signature is required for Signatory ${i + 1}` });
        }

        const sla = await resolveToken(token);
        if (!sla) return res.status(400).json({ message: "Invalid signing link" });

        if (sla.status === "SIGNED" || sla.SLASignature.length > 0)
            return res.status(400).json({ message: "This SLA has already been fully signed" });

        if (new Date() > new Date(sla.signingTokenExpiry))
            return res.status(400).json({ message: "This signing link has expired" });

        const MAX_SIGS = 4;
        if (signatures.length < 1 || signatures.length > MAX_SIGS)
            return res.status(400).json({ message: `Between 1 and ${MAX_SIGS} signatures are allowed (received ${signatures.length})` });

        const signedAt = new Date();

        // Create all signature records in one transaction
        await prisma.$transaction(
            signatures.map((s, i) =>
                prisma.sLASignature.create({
                    data: {
                        slaId          : sla.id,
                        signerName     : s.signerName.trim(),
                        signerEmail    : clientInfo.email?.trim() || null,
                        signerCompany  : clientInfo.company?.trim() || null,
                        signatureImage : s.signatureDataUrl,
                        signedAt,
                        slot           : i + 1,
                    },
                })
            )
        );

        // Update SLA with client info from the form
        const slaForPdf = {
            ...sla,
            clientName    : clientInfo.company.trim(),
            clientEmail   : clientInfo.email?.trim() || null,
            clientPhone   : clientInfo.phone?.trim() || null,
            clientAddress : clientInfo.address?.trim() || null,
        };

        await prisma.sLA.update({
            where: { id: sla.id },
            data : {
                clientName    : slaForPdf.clientName,
                clientEmail   : slaForPdf.clientEmail,
                clientPhone   : slaForPdf.clientPhone,
                clientAddress : slaForPdf.clientAddress,
                status        : "SIGNED",
                signedAt,
            },
        });

        const company = await companySettingsForSla(sla);

        let pdfBuffer;
        if (sla.templateId) {
            const template = await prisma.sLATemplate.findUnique({ where: { id: sla.templateId } });
            if (template && fs.existsSync(template.filePath))
                pdfBuffer = await generateSLAPDFFromTemplate({ sla: slaForPdf, company, templatePath: template.filePath });
        }
        if (!pdfBuffer) pdfBuffer = await generateSLAPDF({ sla: slaForPdf, company });

        // Re-fetch signatures from DB for embedding (includes IDs / timestamps)
        const allSignatures = await prisma.sLASignature.findMany({
            where: { slaId: sla.id }, orderBy: { slot: "asc" },
        });

        const clientSigners = allSignatures.map((s) => ({
            signatureData : s.signatureImage,
            signerName    : s.signerName,
            signerCompany : s.signerCompany,
            signedAt      : s.signedAt,
        }));
        // Provider always occupies the LEFT slot (signature image if configured,
        // otherwise just a signature line); client signer(s) follow on the right.
        const providerEntry = [{
            signatureData     : company?.providerSignature || "",
            signerName        : company?.companyName || "Service Provider",
            signerDesignation : "Chief Business Officer",
            signerCompany     : company?.companyName || "",
            signedAt          : sla.createdAt || new Date(),
        }];
        const signedPdf = await embedSignaturesInPdf(pdfBuffer, [...providerEntry, ...clientSigners]);

        const fileName      = `${sla.slaNumber.replace(/[^a-zA-Z0-9-]/g, "_")}_signed.pdf`;
        const signedPdfPath = path.join(SIGNED_DIR, fileName);
        fs.writeFileSync(signedPdfPath, signedPdf);

        await prisma.sLA.update({
            where: { id: sla.id },
            data : { signedPdfPath },
        });

        // Notify admin (non-blocking)
        sendSignedSLAEmail({
            sla         : slaForPdf,
            company,
            signedPdfBuffer : signedPdf,
            signedAt,
            adminEmail  : sla.createdBy?.email,
            signers     : allSignatures,
        }).catch((e) => console.error("[sign notify]", e));

        return res.json({ complete: true, pdfBase64: signedPdf.toString("base64"), fileName });

    } catch (err) {
        console.error("[sign submit]", err);
        res.status(500).json({ message: "Error processing signature", error: err.message });
    }
};

module.exports = { getSigningPage, getSigningPdf, downloadSignedPdf, submitSignature };
