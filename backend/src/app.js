// Server entry point - Reloaded after Prisma sync
const express = require("express");
const cors = require("cors");
const redocUI = require("redoc-express");
const openapiSpec = require("./config/redoc");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const leadRoutes = require("./routes/lead");
const teamRoutes = require("./routes/team");
const noteRoutes = require("./routes/note");

const taskRoutes = require("./routes/task");
const integrationRoutes = require("./routes/integration");
const reminderRoutes = require("./routes/reminder");
const analyticsRoutes = require("./routes/analytics");
const commissionRoutes = require("./routes/commission");
const webhookRoutes = require("./routes/webhook");
const callLogRoutes = require("./routes/callLog");
const reportRoutes = require("./routes/report");
const exportRoutes = require("./routes/export");
const searchRoutes = require("./routes/search");
const searchLeadsRoutes = require("./routes/searchLeads");
const linkedinLeadsRoutes = require("./routes/linkedinLeads");
const sprintRoutes = require("./routes/sprint");
const auditRoutes = require("./routes/audit");
const sessionRoutes = require("./routes/session");
const metaAdsRoutes = require("./routes/metaAds");

const app = express();

app.set("trust proxy", true);
app.set("etag", false);
const allowedOrigins = (process.env.FRONTEND_URL || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (
            allowedOrigins.includes("*") ||
            allowedOrigins.includes(origin) ||
            (process.env.NODE_ENV !== "production" &&
                (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")))
        ) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
}));
app.use(express.json({ limit: "15mb" }));   // signatures / images are base64 in the JSON body
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.send("Backend is running... Visit <a href='/api-docs'>API Docs</a>");
});

// ── API Documentation ────────────────────────────────────────────────────────
// Serve raw OpenAPI JSON spec
app.get("/api-spec.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openapiSpec);
});

// Serve Redoc UI
app.get(
    "/docs",
    redocUI({
        title: "ZX-CRM API Documentation",
        specUrl: "/api-spec.json",
        redocOptions: {
            theme: {
                colors: {
                    primary: { main: "#6366f1" },
                },
                sidebar: {
                    backgroundColor: "#0f172a",
                    textColor: "#e2e8f0",
                },
                typography: {
                    fontFamily: "Inter, sans-serif",
                    fontSize: "15px",
                    headings: { fontFamily: "Inter, sans-serif" },
                },
            },
            disableSearch: false,
            expandResponses: "200,201",
        },
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/team", teamRoutes);

// High priority unauthenticated or custom-authenticated routes
app.use("/api/webhooks", webhookRoutes);
app.use("/api/platform", require("./routes/platform"));
app.use("/api/capture", require("./routes/capture"));

// Generic mount paths with internal router-level middlewares
app.use("/api", noteRoutes);
app.use("/api", taskRoutes);

app.use("/api/integrations/meta", metaAdsRoutes);
app.use("/api/integrations/gmail", require("./routes/gmail"));
app.use("/api/integrations", integrationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/commission", commissionRoutes);
// TeleCMI CDR webhook — public, no auth, must be registered before callLogRoutes
app.post("/api/calls/telecmi-webhook", require("./controllers/callLogController").telecmiCdrWebhook);
// PIOPIY CDR webhook — public, no auth (ZenVoice AI call recordings)
app.post("/api/calls/piopiy-cdr", require("./controllers/callLogController").piopiyCdrWebhook);
// PIOPIY webhook registration — requires auth, called once after setting PIOPIY_API_KEY
app.post("/api/calls/register-piopiy-webhook", require("./middleware/authMiddleware"), require("./controllers/callLogController").registerPiopiyWebhook);
app.use("/api/calls", callLogRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/search-leads", searchLeadsRoutes);
app.use("/api/linkedin-leads", linkedinLeadsRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/departments", require("./routes/department"));
// Stream webhook — public, no auth; must be before the auth-gated chat router
app.post("/api/chat/webhook", require("./controllers/chatController").streamWebhook);
app.use("/api/chat", require("./routes/chat"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/leave", require("./routes/leave"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/livekit", require("./routes/livekit"));
app.use("/api/user-status", require("./routes/userStatus"));
app.use("/api/campaign-proxy", require("./routes/campaignProxy"));
app.use("/api/invoices", require("./routes/invoice"));
app.use("/api/sla", require("./routes/sla"));
app.use("/sign",    require("./routes/sign"));   // public signing pages — no /api prefix
app.use("/api/fasterq", require("./routes/fasterq"));
app.use("/api/company-settings", require("./routes/companySettings"));
app.use("/api/demo-booking", require("./routes/demoBooking"));
app.use("/api/notifications", require("./routes/notification"));
app.use("/api/permissions", require("./routes/permission"));
app.use("/api/voicelink", require("./routes/voicelink"));
app.use("/api/payments", require("./routes/payment"));
app.use("/api/zxcall", require("./routes/zxcall"));

app.use((err, req, res, _next) => {
    console.error("[GLOBAL ERROR]", req.method, req.path, err.stack || err.message);
    res.status(500).json({ message: "Internal server error", error: err.message });
});

module.exports = app;
