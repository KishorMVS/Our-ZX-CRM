const { AccessToken, WebhookReceiver, EgressClient } = require("livekit-server-sdk");
const prisma = require("../utils/prisma");
const { getWorkspaceFilter } = require("../utils/workspaceScope");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Ensure recordings folder exists
const recordingsDir = path.join(__dirname, "../../../uploads/recordings");
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

/**
 * Generates an Access Token for a user to join a LiveKit room.
 */
const getToken = async (req, res) => {
    try {
        const { roomName, participantName } = req.body;

        if (!roomName || !participantName) {
            return res.status(400).json({ message: "roomName and participantName are required" });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            console.error("[LIVEKIT] Missing LiveKit credentials in .env");
            return res.status(500).json({ message: "LiveKit server credentials are not configured on the backend." });
        }

        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantName,
            name: participantName,
        });

        // Set video grants
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            roomRecord: true, // Allow server-side recording triggers
        });

        const token = await at.toJwt();

        res.json({
            token,
            serverUrl: livekitUrl,
        });
    } catch (error) {
        console.error("[LIVEKIT_TOKEN_ERROR]", error);
        res.status(500).json({ message: "Failed to generate LiveKit token", error: error.message });
    }
};

/**
 * Handles incoming webhooks from the LiveKit server.
 * This is used to capture Server-Side recording (Egress) completion events.
 */
const handleWebhook = async (req, res) => {
    try {
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(500).json({ message: "LiveKit credentials not configured" });
        }

        const receiver = new WebhookReceiver(apiKey, apiSecret);
        
        // Verify the webhook event signature
        const authHeader = req.headers.authorization || "";
        const event = await receiver.receive(req.body, authHeader);

        console.log(`[LIVEKIT_WEBHOOK] Received event: ${event.event}`, event);

        // We check for egress completion
        if (event.event === "egress_ended" && event.egressInfo) {
            const info = event.egressInfo;
            const fileInfo = info.file || info.fileResults?.[0];

            if (fileInfo && fileInfo.location) {
                const cloudUrl = fileInfo.location;
                const fileName = fileInfo.filename || `egress-${info.egressId}-${Date.now()}.mp4`;
                const roomName = info.roomName || "Unknown Room";

                console.log(`[LIVEKIT_WEBHOOK] Egress recording complete. Cloud URL: ${cloudUrl}. Downloading to CRM...`);

                // Run download in background
                downloadRecording(cloudUrl, fileName, roomName)
                    .then((recording) => {
                        console.log(`[LIVEKIT_WEBHOOK] Recording successfully downloaded and saved to DB: ${recording.id}`);
                    })
                    .catch((err) => {
                        console.error("[LIVEKIT_WEBHOOK] Failed to download and save recording:", err);
                    });
            }
        }

        res.json({ message: "Webhook processed" });
    } catch (error) {
        console.error("[LIVEKIT_WEBHOOK_ERROR]", error);
        res.status(500).json({ message: "Webhook error", error: error.message });
    }
};

/**
 * Helper to download recording from S3/LiveKit Cloud to local backend directory
 */
const downloadRecording = async (url, fileName, roomName) => {
    const destinationPath = path.join(recordingsDir, fileName);
    const fileUrl = `/uploads/recordings/${fileName}`;

    console.log(`[LIVEKIT_DOWNLOAD] Downloading ${url} -> ${destinationPath}`);

    const response = await axios({
        method: "get",
        url: url,
        responseType: "stream",
    });

    const writer = fs.createWriteStream(destinationPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", async () => {
            try {
                // Calculate file size
                const stats = fs.statSync(destinationPath);
                
                // Try to find a user to link as creator (e.g. any Super Admin or the first active user)
                const firstAdmin = await prisma.user.findFirst({
                    where: { role: "SUPER_ADMIN" }
                });

                if (!firstAdmin) {
                    throw new Error("No Admin user found to associate with recording creatorId");
                }

                // Write to database
                const recording = await prisma.meetingRecording.create({
                    data: {
                        roomName,
                        fileName,
                        fileUrl,
                        fileSize: stats.size,
                        creatorId: firstAdmin.id,
                    },
                });
                resolve(recording);
            } catch (dbErr) {
                reject(dbErr);
            }
        });
        writer.on("error", (err) => {
            reject(err);
        });
    });
};

/**
 * Lists all call recordings from the CRM database.
 */
const getRecordings = async (req, res) => {
    try {
        // MeetingRecording has no workspaceId column — scope through the creator relation.
        const recordings = await prisma.meetingRecording.findMany({
            where: { creator: getWorkspaceFilter(req.user) },
            orderBy: { createdAt: "desc" },
            include: {
                creator: {
                    select: {
                        id: true,
                        name: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        res.json(recordings);
    } catch (error) {
        console.error("[LIVEKIT_GET_RECORDINGS_ERROR]", error);
        res.status(500).json({ message: "Failed to get recordings", error: error.message });
    }
};

/**
 * Deletes a recording from filesystem and database.
 */
const deleteRecording = async (req, res) => {
    try {
        const { id } = req.params;

        // Scope by workspace (through creator) so one tenant can't delete another's recording.
        const recording = await prisma.meetingRecording.findFirst({
            where: { id, creator: getWorkspaceFilter(req.user) },
        });

        if (!recording) {
            return res.status(404).json({ message: "Recording not found" });
        }

        // Delete from local disk
        const filePath = path.join(recordingsDir, recording.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        await prisma.meetingRecording.delete({
            where: { id },
        });

        res.json({ message: "Recording deleted successfully" });
    } catch (error) {
        console.error("[LIVEKIT_DELETE_RECORDING_ERROR]", error);
        res.status(500).json({ message: "Failed to delete recording", error: error.message });
    }
};

/**
 * Starts a Server-Side Composite Egress recording for a LiveKit room.
 */
const startRecording = async (req, res) => {
    try {
        const { roomName } = req.body;
        if (!roomName) {
            return res.status(400).json({ message: "roomName is required" });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return res.status(500).json({ message: "LiveKit server credentials not configured on the backend." });
        }

        const hostUrl = livekitUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
        const egressClient = new EgressClient(hostUrl, apiKey, apiSecret);

        // Start Composite recording (saving to file, which uses default cloud bucket like S3)
        const egressInfo = await egressClient.startRoomCompositeEgress(roomName, {
            file: {
                filepath: `recordings/${roomName}-${Date.now()}.mp4`,
            }
        });

        res.json({
            message: "Server-side recording started successfully",
            egressId: egressInfo.egressId,
        });
    } catch (error) {
        console.error("[LIVEKIT_START_RECORDING_ERROR]", error);
        res.status(500).json({
            message: "Failed to start server-side recording. Ensure Egress is configured on LiveKit Cloud.",
            error: error.message,
        });
    }
};

/**
 * Stops an active LiveKit Egress recording.
 */
const stopRecording = async (req, res) => {
    try {
        const { egressId } = req.body;
        if (!egressId) {
            return res.status(400).json({ message: "egressId is required" });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return res.status(500).json({ message: "LiveKit server credentials not configured on the backend." });
        }

        const hostUrl = livekitUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
        const egressClient = new EgressClient(hostUrl, apiKey, apiSecret);

        const egressInfo = await egressClient.stopEgress(egressId);

        res.json({
            message: "Server-side recording stopping request sent",
            egressInfo,
        });
    } catch (error) {
        console.error("[LIVEKIT_STOP_RECORDING_ERROR]", error);
        res.status(500).json({ message: "Failed to stop recording", error: error.message });
    }
};

module.exports = {
    getToken,
    handleWebhook,
    getRecordings,
    deleteRecording,
    startRecording,
    stopRecording,
};
