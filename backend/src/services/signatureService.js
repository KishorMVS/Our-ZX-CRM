const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

/**
 * Embeds multiple hand-drawn signatures at the bottom of the last PDF page.
 * Signers are placed 2-per-row, left-to-right.
 *
 * @param {Buffer} pdfBuffer
 * @param {Array}  signers  [{ signatureData, signerName, signerDesignation, signerCompany, signedAt }]
 * @returns {Buffer}
 */
async function embedSignaturesInPdf(pdfBuffer, signers) {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages  = pdfDoc.getPages();
    const page   = pages[pages.length - 1];
    const { width } = page.getSize();

    const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const COLS      = 2;
    const BLOCK_W   = 220;
    const BLOCK_H   = 70;  // signature image height
    const COL_GAP   = 40;
    const ROW_GAP   = 140; // must exceed BLOCK_H + text_below (70+35) + gap
    const BASE_Y    = 130; // distance from bottom for first row

    const rows = Math.ceil(signers.length / COLS);

    // Draw a light separator line across the full width
    page.drawLine({
        start: { x: 40, y: BASE_Y + (rows - 1) * ROW_GAP + BLOCK_H + 30 },
        end:   { x: width - 40, y: BASE_Y + (rows - 1) * ROW_GAP + BLOCK_H + 30 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText("Authorised Signature(s)", {
        x: 40,
        y: BASE_Y + (rows - 1) * ROW_GAP + BLOCK_H + 36,
        size: 7,
        font,
        color: rgb(0.6, 0.6, 0.6),
    });

    for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        const col    = i % COLS;
        const row    = Math.floor(i / COLS);

        const totalBlocksWidth = Math.min(signers.length, COLS) * BLOCK_W + (Math.min(signers.length, COLS) - 1) * COL_GAP;
        const startX = (width - totalBlocksWidth) / 2;
        const blockX = startX + col * (BLOCK_W + COL_GAP);
        const blockY = BASE_Y + (rows - 1 - row) * ROW_GAP;

        // Signature image — accept PNG or JPEG; tolerate a missing image (line only)
        const raw = signer.signatureData || "";
        let sigImage = null;
        try {
            if (/^data:image\/jpe?g/i.test(raw)) {
                const b64 = raw.replace(/^data:image\/jpe?g;base64,/i, "");
                sigImage  = await pdfDoc.embedJpg(Buffer.from(b64, "base64"));
            } else if (raw) {
                const b64 = raw.replace(/^data:image\/\w+;base64,/i, "");
                sigImage  = await pdfDoc.embedPng(Buffer.from(b64, "base64"));
            }
        } catch (e) {
            console.error("[embedSignatures] could not embed image, falling back to line:", e.message);
        }

        if (sigImage) {
            page.drawImage(sigImage, {
                x: blockX, y: blockY + 2,
                width: BLOCK_W, height: BLOCK_H,
            });
        }

        // Underline
        page.drawLine({
            start: { x: blockX,           y: blockY },
            end:   { x: blockX + BLOCK_W, y: blockY },
            thickness: 0.8,
            color: rgb(0.4, 0.4, 0.4),
        });

        // Name
        const displayName = (signer.signerName || "").slice(0, 32);
        page.drawText(displayName, {
            x: blockX, y: blockY - 13,
            size: 10, font: boldFont,
            color: rgb(0.1, 0.1, 0.1),
        });

        // Designation / Company
        const subLine = [signer.signerDesignation, signer.signerCompany].filter(Boolean).join(", ");
        if (subLine) {
            page.drawText(subLine.slice(0, 38), {
                x: blockX, y: blockY - 24,
                size: 8, font,
                color: rgb(0.4, 0.4, 0.4),
            });
        }

        // Timestamp
        const dateStr = new Date(signer.signedAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
        });
        const timeStr = new Date(signer.signedAt).toLocaleTimeString("en-IN", {
            hour: "2-digit", minute: "2-digit",
        });
        page.drawText(`Signed: ${dateStr} ${timeStr}`, {
            x: blockX, y: blockY - 35,
            size: 7, font,
            color: rgb(0.55, 0.55, 0.55),
        });

        // Signature number label
        if (signers.length > 1) {
            page.drawText(`Signature ${i + 1}`, {
                x: blockX, y: blockY + BLOCK_H + 4,
                size: 7, font,
                color: rgb(0.6, 0.6, 0.6),
            });
        }
    }

    const signed = await pdfDoc.save();
    return Buffer.from(signed);
}

module.exports = { embedSignaturesInPdf };
