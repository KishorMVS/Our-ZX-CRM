const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const callLogController = require("../controllers/callLogController");
const authMiddleware = require("../middleware/authMiddleware");

// Ensure recordings directory exists
const recordingsDir = path.join(__dirname, "../../uploads/recordings");
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

// Multer config for recording uploads
const recordingStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, recordingsDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const recordingUpload = multer({
    storage: recordingStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"];
        if (!allowed.includes(ext)) {
            return cb(new Error(`File type ${ext} not allowed. Accepted: ${allowed.join(", ")}`), false);
        }
        cb(null, true);
    }
});

/**
 * @openapi
 * /api/calls/greeter-webhook:
 *   post:
 *     summary: Greeter webhook for call logs
 *     description: Public endpoint for Greeter to push call data.
 *     tags:
 *       - Call Logs
 *     responses:
 *       200:
 *         description: Webhook received
 */
router.post("/greeter-webhook", callLogController.greeterWebhook);

// TeleCMI CDR webhook — no auth, TeleCMI posts here after every call ends
// Configure in TeleCMI dashboard: Settings → Webhooks → type: call report → POST
router.post("/telecmi-webhook", callLogController.telecmiCdrWebhook);

// Recording proxy — no auth: <audio> elements can't send Bearer tokens
router.get("/stream-recording/:callLogId", callLogController.streamRecording);

// Protected routes
router.use(authMiddleware);

/**
 * @openapi
 * /api/calls/log:
 *   post:
 *     summary: Log a manual call
 *     tags:
 *       - Call Logs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leadId, callType, callStatus]
 *             properties:
 *               leadId: { type: string }
 *               callType: { type: string, enum: [INBOUND, OUTBOUND, MISSED] }
 *               callStatus: { type: string }
 *               duration: { type: integer }
 *     responses:
 *       201:
 *         description: Call logged
 *       401:
 *         description: Unauthorized
 */
router.post("/log", callLogController.logCall);

/**
 * @openapi
 * /api/calls/click2call:
 *   post:
 *     summary: Initiate click-to-call
 *     description: Trigger an outgoing call through a telephony provider.
 *     tags:
 *       - Call Logs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber: { type: string }
 *               leadId: { type: string }
 *     responses:
 *       200:
 *         description: Call initiated
 *       401:
 *         description: Unauthorized
 */
router.post("/click2call", callLogController.initiateCall);

/**
 * @openapi
 * /api/calls/upload-recording:
 *   post:
 *     summary: Upload call recording
 *     tags:
 *       - Call Logs
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               recording:
 *                 type: string
 *                 format: binary
 *               callLogId: { type: string }
 *     responses:
 *       200:
 *         description: Recording uploaded
 *       401:
 *         description: Unauthorized
 */
router.post("/upload-recording", recordingUpload.single("recording"), callLogController.uploadRecording);

/**
 * @openapi
 * /api/calls/{leadId}:
 *   get:
 *     summary: Get call logs for a lead
 *     tags:
 *       - Call Logs
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of call logs
 *       401:
 *         description: Unauthorized
 */
router.get("/:leadId", callLogController.getCallLogs);

/**
 * @openapi
 * /api/calls/detail/{callLogId}:
 *   get:
 *     summary: Get specific call log details
 *     tags:
 *       - Call Logs
 *     parameters:
 *       - in: path
 *         name: callLogId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Call log detail
 *       401:
 *         description: Unauthorized
 */
router.get("/detail/:callLogId", callLogController.getCallLogDetails);

/**
 * @openapi
 * /api/calls/transcribe/{callLogId}:
 *   post:
 *     summary: Transcribe a call recording
 *     tags:
 *       - Call Logs
 *     parameters:
 *       - in: path
 *         name: callLogId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transcription started/completed
 *       401:
 *         description: Unauthorized
 */
router.post("/transcribe/:callLogId", callLogController.transcribeCall);

/**
 * @openapi
 * /api/calls/upload-and-transcribe:
 *   post:
 *     summary: Upload audio and transcribe immediately
 *     tags:
 *       - Call Logs
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Transcription result
 *       401:
 *         description: Unauthorized
 */
router.post("/upload-and-transcribe", recordingUpload.single("audio"), callLogController.uploadAndTranscribe);

// Sync INITIATED AI callLogs with ZenVoice call-logs API
router.post("/sync-zenvoice", callLogController.syncZenVoiceCallLogs);

module.exports = router;
