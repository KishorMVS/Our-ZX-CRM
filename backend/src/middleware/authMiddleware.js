const jwt = require("jsonwebtoken");

// Paths that must be reachable without a JWT (e.g. external provider webhooks)
const PUBLIC_PATHS = ["/api/calls/telecmi-webhook", "/api/calls/stream-recording/"];

const authMiddleware = (req, res, next) => {
    if (PUBLIC_PATHS.some((p) => req.originalUrl.startsWith(p))) return next();

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        console.log("authMiddleware rejected request for:", req.originalUrl, "due to no token");
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1]; // Extract Bearer token

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user to request
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = authMiddleware;
