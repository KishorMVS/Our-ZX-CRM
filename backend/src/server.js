require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const startScheduler = require("./scheduler");
const startCronJobs = require("./utils/cron");
const { startTokenRefresh } = require("./services/voicelinkService");
const socketManager = require("./utils/socketManager");

const PORT = process.env.PORT || 5001;

// Start Background Jobs
startScheduler();
startCronJobs();

// Start VoiceLink token auto-refresh (login + hourly renewal)
startTokenRefresh();

// ── AI Outbound Call Pipeline ─────────────────────────────────────────────
// Start BullMQ worker + pre-fetch ZenVoice assistants (requires Redis)
const initCallPipeline = async () => {
    try {

        const { detectRedisAvailability } = require("./queues/redisConnection");
        const redisOnline = await detectRedisAvailability();

        if (redisOnline) {
            console.log("[CallPipeline] Redis detected online. Starting BullMQ queue worker...");
            const { startWorker } = require("./queues/callQueue");
            startWorker();
        } else {
            console.log("[CallPipeline] ℹ️ Redis is offline. Auto-call pipeline will run in DIRECT (In-Memory) Mode.");
            console.log("[CallPipeline] Zero Redis connection errors will be printed. Direct calling pipeline is active!");
        }

        // Pre-fetch and cache assistants from ZenVoice
        if (process.env.ZENVOICE_EMAIL && process.env.ZENVOICE_PASSWORD) {
            const { fetchAssistants } = require("./services/zenvoiceService");
            const assistants = await fetchAssistants();
            console.log(`[CallPipeline] ✅ Ready — ${assistants.length} assistant(s) loaded`);
        } else {
            console.warn("[CallPipeline] ⚠️ ZENVOICE_EMAIL/PASSWORD not set — assistant auto-fetch skipped");
        }
    } catch (err) {
        console.error("[CallPipeline] ⚠️ Init failed (server continues):", err.message);
    }
};
initCallPipeline();

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});
socketManager.init(io);

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("✅ Backend initialized at " + new Date().toISOString());
});
// Nodemon restart trigger
