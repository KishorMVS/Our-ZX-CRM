const jwt = require("jsonwebtoken");

const platformMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log("platformMiddleware rejected request for:", req.originalUrl, "due to no token");
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
        if (decoded.role !== "PLATFORM_OWNER") {
            return res.status(403).json({ message: "Platform access denied" });
        }
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = platformMiddleware;
