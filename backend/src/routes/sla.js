const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
    createSLA, getSLAs, getSLA, deleteSLA, updateSLA,
    resendSigningLink, downloadSignedSla, previewSLA,
} = require("../controllers/slaController");
const { uploadTemplate, getTemplates, deleteTemplate, downloadTemplate } = require("../controllers/slaTemplateController");

const templatesDir = path.join(__dirname, "../../uploads/sla-templates");
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, templatesDir),
        filename   : (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.originalname.endsWith(".docx")
        ) cb(null, true);
        else cb(new Error("Only .docx files are allowed"), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);

// Preview (generates PDF without creating SLA)
router.post("/preview", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), previewSLA);

// SLA records
router.get("/",    getSLAs);
router.post("/",   roleMiddleware(["SUPER_ADMIN", "ADMIN"]), createSLA);
router.get("/:id", getSLA);
router.put("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateSLA);
router.delete("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deleteSLA);

// Signing link management
router.post("/:id/resend-link",     roleMiddleware(["SUPER_ADMIN", "ADMIN"]), resendSigningLink);
router.get("/:id/download-signed",  downloadSignedSla);

// SLA templates
router.get("/templates/list",            getTemplates);
router.get("/templates/:id/download",    downloadTemplate);
router.post("/templates/upload",         roleMiddleware(["SUPER_ADMIN", "ADMIN"]), upload.single("file"), uploadTemplate);
router.delete("/templates/:id",          roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deleteTemplate);

module.exports = router;
