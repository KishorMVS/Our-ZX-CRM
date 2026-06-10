const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");
const prisma = require("../utils/prisma");
const { upsertUserToStream } = require("../controllers/chatController");

// Ensure upload directory exists
const uploadDir = "uploads/profiles";
const taskUploadDir = "uploads/tasks";
const invoiceSignatureDir = "uploads/signatures";
const companyLogoDir = "uploads/logos";

[uploadDir, taskUploadDir, invoiceSignatureDir, companyLogoDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer storage for signatures
const signatureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, invoiceSignatureDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `sig-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, companyLogoDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const uploadSignature = multer({
    storage: signatureStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|pdf/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype) || file.mimetype === 'application/pdf';
        if (extname && mimetype) cb(null, true);
        else cb(new Error("Only images (jpeg, png, webp) or PDFs are allowed"));
    }
});

const uploadLogo = multer({
    storage: logoStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) cb(null, true);
        else cb(new Error("Only images (jpeg, png, webp) are allowed"));
    }
});

// Configure multer storage for profiles
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${req.user.userId}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Configure multer storage for tasks
const taskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, taskUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `task-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter for images only
const profileFileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"));
    }
};

// Multer upload configuration for profiles
const uploadProfile = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: profileFileFilter
});

// Multer upload configuration for tasks (allows docs/pdfs too)
const uploadTask = multer({
    storage: taskStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Upload profile photo
/**
 * @openapi
 * /api/upload/profile-photo:
 *   post:
 *     summary: Upload profile photo
 *     description: Upload a new profile picture for the current user. Restricted to images (jpeg, png, webp).
 *     tags:
 *       - Upload
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile photo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 user: { $ref: "#/components/schemas/User" }
 *       400:
 *         description: Bad Request - No file uploaded or invalid file type
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete profile photo
 *     description: Remove the current user's profile picture from the server and database.
 *     tags:
 *       - Upload
 *     responses:
 *       200:
 *         description: Profile photo deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/profile-photo", authMiddleware, uploadProfile.single("photo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const photoUrl = `/uploads/profiles/${req.file.filename}`;

        // Update user's profile photo in database
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { profilePhoto: photoUrl },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profilePhoto: true,
                phone: true,
                department: true
            }
        });

        // Sync with Stream Chat
        try {
            await upsertUserToStream(updatedUser);
        } catch (syncError) {
            console.error("Failed to sync photo update to Stream:", syncError);
        }

        res.json({
            message: "Profile photo uploaded successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Profile photo upload error:", error);

        // Delete uploaded file if database update fails
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
            });
        }

        res.status(500).json({ message: "Failed to upload profile photo" });
    }
});

// Upload group/channel photo
router.post("/group-photo", authMiddleware, uploadProfile.single("photo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const photoUrl = `/uploads/profiles/${req.file.filename}`;
        res.json({ photoUrl });
    } catch (error) {
        console.error("Group photo upload error:", error);
        res.status(500).json({ message: "Failed to upload group photo" });
    }
});

// Upload task files
/**
 * @openapi
 * /api/upload/task-files:
 *   post:
 *     summary: Upload task attachment files
 *     description: Upload up to 5 files (images, docs, pdfs) to be attached to a task.
 *     tags:
 *       - Upload
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: "string" }
 *                 files: { type: "array", items: { $ref: "#/components/schemas/TaskFile" } }
 *       400:
 *         description: Bad Request - No files uploaded
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/task-files", authMiddleware, uploadTask.array("files", 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const filesData = req.files.map(file => ({
            fileName: file.originalname,
            fileUrl: `/uploads/tasks/${file.filename}`,
            fileSize: file.size,
            mimeType: file.mimetype
        }));

        res.json({
            message: "Files uploaded successfully",
            files: filesData
        });
    } catch (error) {
        console.error("Task file upload error:", error);
        res.status(500).json({ message: "Failed to upload task files" });
    }
});

// Upload invoice signature
router.post("/invoice-signature", authMiddleware, (req, res, next) => {
    uploadSignature.single("signature")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error("Multer error:", err);
            return res.status(400).json({ message: `Multer error: ${err.message}` });
        } else if (err) {
            console.error("Upload error:", err);
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            console.log("No file in req:", req.body);
            return res.status(400).json({ message: "No file uploaded" });
        }
        const signatureUrl = `/uploads/signatures/${req.file.filename}`;
        res.json({ signatureUrl });
    } catch (error) {
        console.error("Signature upload error:", error);
        res.status(500).json({ message: "Failed to upload signature" });
    }
});

// Upload company logo
router.post("/company-logo", authMiddleware, (req, res, next) => {
    uploadLogo.single("logo")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Multer error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
        const logoUrl = `/uploads/logos/${req.file.filename}`;
        res.json({ logoUrl });
    } catch (error) {
        console.error("Logo upload error:", error);
        res.status(500).json({ message: "Failed to upload logo" });
    }
});

// Delete profile photo
router.delete("/profile-photo", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { profilePhoto: true }
        });

        if (user?.profilePhoto) {
            // Delete file from filesystem
            const filePath = path.join(__dirname, "../..", user.profilePhoto);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Update database
            const updatedUser = await prisma.user.update({
                where: { id: req.user.userId },
                data: { profilePhoto: null },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    profilePhoto: true,
                    phone: true,
                    department: true,
                    onlineStatus: true
                }
            });

            // Sync with Stream Chat
            try {
                await upsertUserToStream(updatedUser);
            } catch (syncError) {
                console.error("Failed to sync photo deletion to Stream:", syncError);
            }

            return res.json({ 
                message: "Profile photo deleted successfully", 
                user: updatedUser 
            });
        }

        res.json({ message: "No profile photo to delete" });
    } catch (error) {
        console.error("Delete profile photo error:", error);
        res.status(500).json({ message: "Failed to delete profile photo" });
    }
});

// Configure multer storage for recordings
const recordingUploadDir = "uploads/recordings";
if (!fs.existsSync(recordingUploadDir)) {
    fs.mkdirSync(recordingUploadDir, { recursive: true });
}

const recordingStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, recordingUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `rec-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname) || ".webm"}`;
        cb(null, uniqueName);
    }
});

const uploadRecording = multer({
    storage: recordingStorage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for recordings
});

// Upload meeting recording from client
router.post("/recording", authMiddleware, uploadRecording.single("recording"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No recording file uploaded" });
        }

        const roomName = req.body.roomName || "Unnamed Call";
        const duration = req.body.duration ? parseInt(req.body.duration) : null;
        const fileUrl = `/uploads/recordings/${req.file.filename}`;

        // Save to database
        const recording = await prisma.meetingRecording.create({
            data: {
                roomName,
                fileName: req.file.filename,
                fileUrl,
                fileSize: req.file.size,
                duration,
                creatorId: req.user.userId,
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        name: true,
                        profilePhoto: true,
                    }
                }
            }
        });

        res.json({
            message: "Recording uploaded successfully",
            recording,
        });
    } catch (error) {
        console.error("Recording upload error:", error);
        res.status(500).json({ message: "Failed to upload recording" });
    }
});

module.exports = router;
