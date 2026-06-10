const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");
const ctrl = require("../controllers/zxcallController");

// Ensure upload directory exists
const zxcallDir = "uploads/zxcall";
if (!fs.existsSync(zxcallDir)) fs.mkdirSync(zxcallDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, zxcallDir),
    filename: (req, file, cb) => {
        const unique = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, unique);
    },
});

const fileFilter = (req, file, cb) => {
    const ok = /jpeg|jpg|png|pdf/;
    const extOk = ok.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = ok.test(file.mimetype) || file.mimetype === "application/pdf";
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error("Only PDF, JPG or PNG files are allowed"));
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter,
});

const uploadDocs = upload.fields([
    { name: "gstCertificate", maxCount: 1 },
    { name: "incorporationCertificate", maxCount: 1 },
    { name: "aadharCard", maxCount: 1 },
]);

// POST /api/zxcall/onboard — multipart with 3 documents
router.post("/onboard", authMiddleware, (req, res, next) => {
    uploadDocs(req, res, (err) => {
        if (err instanceof multer.MulterError) return res.status(400).json({ message: `Upload error: ${err.message}` });
        if (err) return res.status(400).json({ message: err.message });
        next();
    });
}, ctrl.onboard);

router.post("/create-order", authMiddleware, ctrl.createOrder);
router.post("/verify",       authMiddleware, ctrl.verify);
router.get("/my",            authMiddleware, ctrl.myRequest);
router.get("/c2c-usage",     authMiddleware, ctrl.c2cUsage);
router.post("/click2call",   authMiddleware, ctrl.click2call);
router.get("/telecmi-users", authMiddleware, ctrl.telecmiUsers);

module.exports = router;
