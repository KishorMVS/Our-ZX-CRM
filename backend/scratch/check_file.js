const fs = require("fs");
const path = require("path");

const pathsToTry = [
    path.join(__dirname, "../src/assets/CRM broucher.pdf"),
    path.join(__dirname, "../../frontend/src/assets/CRM broucher.pdf"),
    path.join(__dirname, "../../src/assets/CRM broucher.pdf"),
    "C:/Users/PC User/Desktop/ZXCRM/ZX-CRM/frontend/src/assets/CRM broucher.pdf",
    "C:/Users/PC User/Desktop/ZXCRM/ZX-CRM/frontend/src/assets/CRM brochure.pdf",
];

pathsToTry.forEach(p => {
    console.log(`Checking path: ${p}`);
    console.log(`Exists? ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
        try {
            const stats = fs.statSync(p);
            console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        } catch(e) {}
    }
});
